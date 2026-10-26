package main

import (
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
	defaultDkryptURL = "https://ipa.dylib.dev"
	defaultBundleID  = "com.hammerandchisel.discord"
)

var retryableStatuses = map[int]bool{408: true, 425: true, 429: true, 500: true, 502: true, 503: true, 504: true}

type DkryptError struct{ Message string }

func (e *DkryptError) Error() string { return e.Message }

func runFetch(args []string) error {
	set := flag.NewFlagSet("fetch", flag.ContinueOnError)
	baseURL := set.String("base-url", defaultDkryptURL, "dkrypt base URL that authenticated sources must use")
	version := set.String("version", "", "version of the source IPA")
	output := set.String("output", "", "output IPA path")
	sourceURL := set.String("source-url", "", "direct IPA URL")
	authenticatedSource := set.Bool("authenticated-source", false, "authenticate a direct source URL with DKRYPT_API_KEY")
	channel := set.String("channel", "appstore", "direct source channel")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *output == "" || *sourceURL == "" {
		return errors.New("usage: fetch --source-url <url> --output <path> [--authenticated-source] [--channel <appstore|testflight>] [--version <version>]")
	}
	apiKey, err := sourceAPIKey(*sourceURL, *baseURL, *authenticatedSource)
	if err != nil {
		return err
	}
	if err := downloadDirect(*sourceURL, apiKey, *output); err != nil {
		return err
	}
	return writeOutputs(map[string]string{"channel": *channel, "is_testflight": strconv.FormatBool(*channel == "testflight"), "version": *version, "cache_hit": "false"})
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
