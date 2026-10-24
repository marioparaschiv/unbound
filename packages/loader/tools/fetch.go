package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const (
	defaultDkryptURL    = "https://ipa.dylib.dev"
	defaultBundleID     = "com.hammerandchisel.discord"
	defaultFetchTimeout = 45 * time.Minute
	fetchUserAgent      = "unbound-loader-dkrypt/1.0 (+https://github.com/marioparaschiv/unbound)"
)

var retryableStatuses = map[int]bool{408: true, 425: true, 429: true, 500: true, 502: true, 503: true, 504: true}

type DkryptError struct{ Message string }

func (e *DkryptError) Error() string { return e.Message }

type httpStatusError struct {
	status int
	body   []byte
}

type requestTransportError struct{ err error }

func (e *requestTransportError) Error() string {
	return fmt.Sprintf("could not reach dkrypt: %s", safeMessage(e.err))
}

func (e *requestTransportError) Unwrap() error { return e.err }

func (e *httpStatusError) Error() string {
	return fmt.Sprintf("dkrypt request failed with HTTP %d", e.status)
}

func runFetch(args []string) error {
	set := flag.NewFlagSet("fetch", flag.ContinueOnError)
	baseURL := set.String("base-url", defaultDkryptURL, "dkrypt base URL")
	bundleID := set.String("bundle-id", defaultBundleID, "bundle identifier")
	version := set.String("version", "", "requested version")
	output := set.String("output", "", "output IPA path")
	timeout := set.Duration("timeout", defaultFetchTimeout, "maximum decrypt duration")
	sourceURL := set.String("source-url", "", "direct IPA URL")
	authenticatedSource := set.Bool("authenticated-source", false, "authenticate a direct source URL with DKRYPT_API_KEY")
	channel := set.String("channel", "appstore", "direct source channel")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *output == "" {
		return errors.New("usage: fetch --output <path> [--base-url <url> --bundle-id <id> --version <version> | --source-url <url>]")
	}
	if *sourceURL != "" {
		apiKey, err := sourceAPIKey(*sourceURL, *baseURL, *authenticatedSource)
		if err != nil {
			return err
		}
		if err := downloadDirect(*sourceURL, apiKey, *output); err != nil {
			return err
		}
		return writeOutputs(map[string]string{"channel": *channel, "is_testflight": strconv.FormatBool(*channel == "testflight"), "version": *version, "cache_hit": "false"})
	}
	apiKey := os.Getenv("DKRYPT_API_KEY")
	if apiKey == "" {
		return &DkryptError{"DKRYPT_API_KEY is not set"}
	}
	result, err := fetchIPA(*baseURL, *bundleID, *version, apiKey, *output, *timeout)
	if err != nil {
		fmt.Fprintf(os.Stderr, "::error title=dkrypt::%s\n", safeMessage(err))
		return err
	}
	return printJSON(result)
}

func fetchIPA(baseURL, bundleID, version, apiKey, output string, timeout time.Duration) (map[string]string, error) {
	return fetchIPAWith(baseURL, bundleID, version, apiKey, output, timeout, time.Sleep, time.Now)
}

func fetchIPAWith(baseURL, bundleID, version, apiKey, output string, timeout time.Duration, sleep func(time.Duration), now func() time.Time) (map[string]string, error) {
	body := map[string]any{"bundleId": bundleID}
	if strings.TrimSpace(version) != "" {
		body["version"] = strings.TrimSpace(version)
	}
	response, err := requestWithRetries(joinURL(baseURL, "/v1/decrypts"), apiKey, http.MethodPost, body)
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	emitDistinct(response, seen)
	cacheHit, _ := response["cacheHit"].(bool)
	status, _ := response["status"].(string)
	deadline := now().Add(timeout)
	for status == "queued" || status == "running" {
		if now().After(deadline) {
			return nil, &DkryptError{fmt.Sprintf("dkrypt job timed out after %d seconds", int(timeout.Seconds()))}
		}
		statusURL, ok := response["statusUrl"].(string)
		if !ok || statusURL == "" {
			return nil, &DkryptError{"dkrypt did not return a status URL for the decrypt job"}
		}
		sleep(10 * time.Second)
		response, err = requestWithRetries(joinURL(baseURL, statusURL), apiKey, http.MethodGet, nil)
		if err != nil {
			return nil, err
		}
		emitDistinct(response, seen)
		status, _ = response["status"].(string)
	}
	if status == "failed" {
		return nil, &DkryptError{fmt.Sprintf("dkrypt decrypt failed: %s", safeMessage(response["error"]))}
	}
	if status != "done" {
		return nil, &DkryptError{fmt.Sprintf("dkrypt returned an unexpected job status: %s", safeMessage(status))}
	}
	artifact := artifactPayload(response)
	artifactID, _ := artifact["id"].(string)
	if artifactID != "" {
		if _, ok := artifact["sha256"]; !ok {
			artifact, err = requestWithRetries(joinURL(baseURL, "/v1/artifacts/"+artifactID), apiKey, http.MethodGet, nil)
			if err != nil {
				return nil, err
			}
		}
	}
	fileURL, _ := artifact["fileUrl"].(string)
	if fileURL == "" {
		fileURL, _ = response["artifactUrl"].(string)
	}
	if fileURL == "" {
		fileURL, _ = response["fileUrl"].(string)
	}
	expectedSize, ok := numberValue(artifact["sizeBytes"])
	if !ok {
		expectedSize, ok = numberValue(response["sizeBytes"])
	}
	expectedSHA, _ := artifact["sha256"].(string)
	if expectedSHA == "" {
		expectedSHA, _ = response["sha256"].(string)
	}
	if fileURL == "" || !ok || expectedSize < 1 || len(expectedSHA) != 64 {
		return nil, &DkryptError{"dkrypt did not return complete artifact metadata"}
	}
	channel, _ := response["channel"].(string)
	if channel != "appstore" && channel != "testflight" {
		if testFlight, _ := response["testflight"].(bool); testFlight {
			channel = "testflight"
		} else {
			channel = "appstore"
		}
	}
	resolvedVersion, _ := response["resolvedVersion"].(string)
	if resolvedVersion == "" {
		resolvedVersion, _ = response["versionLabel"].(string)
	}
	if resolvedVersion == "" {
		resolvedVersion, _ = artifact["versionLabel"].(string)
	}
	if resolvedVersion == "" {
		resolvedVersion = strings.TrimSpace(version)
	}
	if resolvedVersion == "" {
		resolvedVersion = "latest"
	}
	if cacheHit {
		notice(fmt.Sprintf("cache hit for %s %s", channel, resolvedVersion))
	} else {
		notice(fmt.Sprintf("cache miss; decrypted %s %s", channel, resolvedVersion))
	}
	if err := downloadAndVerify(joinURL(baseURL, fileURL), apiKey, output, expectedSize, expectedSHA); err != nil {
		return nil, err
	}
	notice(fmt.Sprintf("downloaded and verified %d bytes (%s)", expectedSize, expectedSHA))
	result := map[string]string{"channel": channel, "is_testflight": strconv.FormatBool(channel == "testflight"), "version": resolvedVersion, "cache_hit": strconv.FormatBool(cacheHit), "artifact_id": artifactID, "sha256": expectedSHA, "size_bytes": strconv.FormatInt(expectedSize, 10)}
	if err := writeOutputs(result); err != nil {
		return nil, err
	}
	return result, nil
}

func requestWithRetries(endpoint, apiKey, method string, body map[string]any) (map[string]any, error) {
	return requestWithRetriesUsing(endpoint, apiKey, method, body, requestJSON, time.Sleep)
}

func requestWithRetriesUsing(
	endpoint, apiKey, method string,
	body map[string]any,
	request func(string, string, string, map[string]any) (map[string]any, error),
	sleep func(time.Duration),
) (map[string]any, error) {
	var last error
	for attempt := 1; attempt <= 3; attempt++ {
		result, err := request(endpoint, apiKey, method, body)
		if err == nil {
			return result, nil
		}
		last = err
		statusErr, ok := err.(*httpStatusError)
		var transportErr *requestTransportError
		retryable := ok && retryableStatuses[statusErr.status]
		retryable = retryable || method == http.MethodGet && errors.As(err, &transportErr)
		if !retryable || attempt == 3 {
			return nil, err
		}
		sleep(time.Duration(1<<(attempt-1)) * time.Second)
	}
	return nil, last
}

func requestJSON(endpoint, apiKey, method string, body map[string]any) (map[string]any, error) {
	var reader io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reader = strings.NewReader(string(encoded))
	}
	request, err := http.NewRequest(method, endpoint, reader)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("User-Agent", fetchUserAgent)
	request.Header.Set("Authorization", "Bearer "+apiKey)
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	response, err := (&http.Client{Timeout: 60 * time.Second}).Do(request)
	if err != nil {
		return nil, &requestTransportError{err}
	}
	defer response.Body.Close()
	raw, readErr := io.ReadAll(response.Body)
	if readErr != nil {
		return nil, &requestTransportError{readErr}
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, &httpStatusError{status: response.StatusCode, body: raw}
	}
	return parseJSON(raw)
}

func downloadAndVerify(endpoint, apiKey, output string, expectedSize int64, expectedSHA string) error {
	return downloadAndVerifyWith(endpoint, apiKey, output, expectedSize, expectedSHA, 5, time.Sleep)
}

func downloadAndVerifyWith(endpoint, apiKey, output string, expectedSize int64, expectedSHA string, attempts int, sleep func(time.Duration)) error {
	if attempts < 1 {
		return errors.New("download retry count must be positive")
	}

	client := &http.Client{Timeout: 60 * time.Minute}
	var lastErr error
	for attempt := 1; attempt <= attempts; attempt++ {
		request, err := http.NewRequest(http.MethodGet, endpoint, nil)
		if err != nil {
			return err
		}
		request.Header.Set("Authorization", "Bearer "+apiKey)
		request.Header.Set("Accept", "application/octet-stream")
		request.Header.Set("User-Agent", fetchUserAgent)

		response, err := client.Do(request)
		if err != nil {
			lastErr = &DkryptError{fmt.Sprintf("could not download the IPA from dkrypt: %s", safeMessage(err))}
			if attempt < attempts {
				sleep(time.Duration(1<<(attempt-1)) * time.Second)
				continue
			}
			return lastErr
		}

		if response.StatusCode < 200 || response.StatusCode >= 300 {
			raw, _ := io.ReadAll(response.Body)
			response.Body.Close()
			lastErr = &DkryptError{fmt.Sprintf("could not download the IPA from dkrypt: HTTP %d %s", response.StatusCode, safeMessage(string(raw)))}
			if attempt == attempts || !retryableStatuses[response.StatusCode] {
				return lastErr
			}
			sleep(time.Duration(1<<(attempt-1)) * time.Second)
			continue
		}

		err = saveVerifiedDownload(response.Body, output, expectedSize, expectedSHA)
		response.Body.Close()
		if err == nil {
			return nil
		}
		lastErr = err
		if attempt < attempts {
			sleep(time.Duration(1<<(attempt-1)) * time.Second)
		}
	}

	return lastErr
}

func saveVerifiedDownload(body io.Reader, output string, expectedSize int64, expectedSHA string) error {
	if err := os.MkdirAll(filepath.Dir(output), 0o755); err != nil {
		return err
	}
	temporary, err := os.CreateTemp(filepath.Dir(output), ".ipa-part-")
	if err != nil {
		return err
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)
	digest := sha256.New()
	size, err := io.Copy(io.MultiWriter(temporary, digest), body)
	if closeErr := temporary.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		return err
	}
	actual := hex.EncodeToString(digest.Sum(nil))
	if size != expectedSize {
		return &DkryptError{fmt.Sprintf("dkrypt IPA size mismatch: expected %d bytes, got %d", expectedSize, size)}
	}
	if !strings.EqualFold(actual, expectedSHA) {
		return &DkryptError{"dkrypt IPA SHA-256 mismatch"}
	}
	return os.Rename(temporaryPath, output)
}

func sourceAPIKey(endpoint, baseURL string, authenticated bool) (string, error) {
	if !authenticated {
		return "", nil
	}
	apiKey := os.Getenv("DKRYPT_API_KEY")
	if apiKey == "" {
		return "", &DkryptError{"DKRYPT_API_KEY is not set for authenticated source download"}
	}
	source, sourceErr := url.Parse(endpoint)
	base, baseErr := url.Parse(baseURL)
	if sourceErr != nil || baseErr != nil || source.Scheme == "" || base.Scheme == "" || !strings.EqualFold(source.Scheme, base.Scheme) || source.Host == "" || base.Host == "" || !strings.EqualFold(source.Host, base.Host) {
		return "", &DkryptError{"authenticated source URL must use the configured dkrypt host"}
	}
	return apiKey, nil
}

func downloadDirect(endpoint, apiKey, output string) error {
	var response *http.Response
	var err error
	client := &http.Client{Timeout: 60 * time.Minute}
	if apiKey != "" {
		allowed, parseErr := url.Parse(endpoint)
		if parseErr != nil {
			return parseErr
		}
		client.CheckRedirect = func(request *http.Request, _ []*http.Request) error {
			if !strings.EqualFold(request.URL.Scheme, allowed.Scheme) || !strings.EqualFold(request.URL.Host, allowed.Host) {
				return http.ErrUseLastResponse
			}
			request.Header.Set("Authorization", "Bearer "+apiKey)
			return nil
		}
	}
	for attempt := 1; attempt <= 3; attempt++ {
		request, requestErr := http.NewRequest(http.MethodGet, endpoint, nil)
		if requestErr != nil {
			return requestErr
		}
		if apiKey != "" {
			request.Header.Set("Authorization", "Bearer "+apiKey)
		}
		response, err = client.Do(request)
		if err == nil && response.StatusCode >= 200 && response.StatusCode < 300 {
			break
		}
		if response != nil {
			response.Body.Close()
			if attempt == 3 || !retryableStatuses[response.StatusCode] {
				return fmt.Errorf("source IPA download failed with HTTP %d", response.StatusCode)
			}
		} else if attempt == 3 {
			return err
		}
		time.Sleep(time.Duration(1<<(attempt-1)) * time.Second)
	}
	if response == nil {
		return errors.New("source IPA download returned no response")
	}
	defer response.Body.Close()
	if err := os.MkdirAll(filepath.Dir(output), 0o755); err != nil {
		return err
	}
	temporary, err := os.CreateTemp(filepath.Dir(output), ".ipa-part-")
	if err != nil {
		return err
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)
	if _, err := io.Copy(temporary, response.Body); err != nil {
		temporary.Close()
		return err
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	return os.Rename(temporaryPath, output)
}

func parseJSON(raw []byte) (map[string]any, error) {
	var value map[string]any
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, &DkryptError{"dkrypt returned an invalid JSON response"}
	}
	if value == nil {
		return nil, &DkryptError{"dkrypt returned an unexpected response"}
	}
	return value, nil
}

func artifactPayload(payload map[string]any) map[string]any {
	if value, ok := payload["artifact"].(map[string]any); ok {
		return value
	}
	if value, ok := payload["artifactId"].(string); ok && value != "" {
		return map[string]any{"id": value}
	}
	return map[string]any{}
}

func numberValue(value any) (int64, bool) {
	switch number := value.(type) {
	case float64:
		return int64(number), number == float64(int64(number))
	case int:
		return int64(number), true
	case int64:
		return number, true
	default:
		return 0, false
	}
}

func statusMessage(payload map[string]any) string {
	if progress, ok := payload["progress"].(string); ok && strings.TrimSpace(progress) != "" {
		return strings.TrimSpace(progress)
	}
	if status, ok := payload["status"].(string); ok {
		return status
	}
	return ""
}

func emitDistinct(payload map[string]any, seen map[string]bool) {
	message := statusMessage(payload)
	if queue, ok := payload["queue"].(map[string]any); ok {
		position, positionOK := numberValue(queue["position"])
		total, totalOK := numberValue(queue["total"])
		if positionOK && totalOK {
			message = fmt.Sprintf("%s (queue position %d/%d)", messageOr(message, "queued"), position, total)
		}
	}
	if message != "" && !seen[message] {
		seen[message] = true
		notice(message)
	}
}

func messageOr(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func notice(message string) {
	message = strings.NewReplacer("%", "%25", "\r", "%0D", "\n", "%0A").Replace(message)
	fmt.Printf("::notice title=dkrypt::%s\n", message)
}

func writeOutputs(values map[string]string) error {
	path := os.Getenv("GITHUB_OUTPUT")
	if path == "" {
		return nil
	}
	file, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	defer file.Close()
	for key, value := range values {
		value = strings.NewReplacer("\r", " ", "\n", " ").Replace(value)
		if _, err := fmt.Fprintf(file, "%s=%s\n", key, value); err != nil {
			return err
		}
	}
	return nil
}

func joinURL(base, value string) string {
	parsed, err := url.Parse(value)
	if err == nil && parsed.IsAbs() {
		return value
	}
	return strings.TrimRight(base, "/") + "/" + strings.TrimLeft(value, "/")
}

func safeMessage(value any) string {
	message := strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(fmt.Sprint(value), "\r", " "), "\n", " "))
	if len(message) > 500 {
		message = message[:500]
	}
	if message == "" || message == "<nil>" {
		return "unknown dkrypt error"
	}
	return message
}
