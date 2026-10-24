package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const defaultLoaderReleaseEndpoint = "https://unbound.rip/api/v1/loader/releases"

type loaderReleasePublishConfig struct {
	endpoint  string
	apiKey    string
	platform  string
	version   string
	url       string
	changelog string
	client    *http.Client
}

type loaderReleaseBatchConfig struct {
	endpoint   string
	apiKey     string
	version    string
	iosURL     string
	androidURL string
	changelog  string
	client     *http.Client
}

type loaderReleaseBatchResult struct {
	published       []string
	skippedPlatform string
	latestVersion   string
}

type loaderReleasePublishRequest struct {
	Platform  string  `json:"platform"`
	Version   string  `json:"version"`
	URL       string  `json:"url"`
	Changelog *string `json:"changelog,omitempty"`
}

type loaderReleasePublishResponse struct {
	Platform string `json:"platform"`
	Version  string `json:"version"`
	URL      string `json:"url"`
}

type loaderLatestUpdateResponse struct {
	Update *struct {
		Version string `json:"version"`
	} `json:"update"`
}

func runPublishLoaderReleases(args []string) error {
	set := flag.NewFlagSet("publish-loader-releases", flag.ContinueOnError)
	endpoint := set.String("api-url", envOr("UNBOUND_API_URL", defaultLoaderReleaseEndpoint), "loader release publication endpoint")
	version := set.String("version", "", "semantic loader version")
	iosURL := set.String("ios-url", "", "public iOS release asset URL")
	androidURL := set.String("android-url", "", "public Android release asset URL")
	changelog := set.String("changelog", "", "optional release changelog")
	changelogFile := set.String("changelog-file", "", "path to release changelog")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *changelogFile != "" {
		contents, err := os.ReadFile(*changelogFile)
		if err != nil {
			return fmt.Errorf("read loader release changelog: %w", err)
		}
		*changelog = strings.TrimSpace(string(contents))
	}

	result, err := publishLoaderReleases(context.Background(), loaderReleaseBatchConfig{
		endpoint:   *endpoint,
		apiKey:     os.Getenv("UNBOUND_API_KEY"),
		version:    *version,
		iosURL:     *iosURL,
		androidURL: *androidURL,
		changelog:  *changelog,
		client:     &http.Client{Timeout: 30 * time.Second},
	})
	if err != nil {
		return err
	}
	if result.skippedPlatform != "" {
		fmt.Printf("Skipped loader release %s because it is older than %s loader %s\n", *version, result.skippedPlatform, result.latestVersion)
		return nil
	}
	if len(result.published) == 0 {
		fmt.Printf("Skipped loader release %s because that semver is already published\n", *version)
		return nil
	}
	for _, platform := range result.published {
		fmt.Printf("Published %s loader release %s\n", platform, *version)
	}
	return nil
}

func publishLoaderReleases(ctx context.Context, config loaderReleaseBatchConfig) (loaderReleaseBatchResult, error) {
	if config.apiKey == "" {
		return loaderReleaseBatchResult{}, errors.New("UNBOUND_API_KEY is required")
	}
	if config.version == "" {
		return loaderReleaseBatchResult{}, errors.New("loader release version is required")
	}
	if _, err := parseSemanticVersion(config.version); err != nil {
		return loaderReleaseBatchResult{}, fmt.Errorf("invalid loader release version: %w", err)
	}
	if err := validateHTTPURL(config.endpoint); err != nil {
		return loaderReleaseBatchResult{}, fmt.Errorf("invalid loader release API URL: %w", err)
	}
	if err := validateHTTPURL(config.iosURL); err != nil {
		return loaderReleaseBatchResult{}, fmt.Errorf("invalid iOS loader release asset URL: %w", err)
	}
	if err := validateHTTPURL(config.androidURL); err != nil {
		return loaderReleaseBatchResult{}, fmt.Errorf("invalid Android loader release asset URL: %w", err)
	}

	client := config.client
	if client == nil {
		client = &http.Client{Timeout: 30 * time.Second}
	}
	platforms := []struct {
		name string
		url  string
	}{
		{name: "ios", url: config.iosURL},
		{name: "android", url: config.androidURL},
	}
	type latestPlatform struct {
		name    string
		url     string
		version string
		exists  bool
	}
	latestPlatforms := make([]latestPlatform, 0, len(platforms))
	for _, platform := range platforms {
		latest, exists, err := latestLoaderReleaseVersion(ctx, config.endpoint, platform.name, client)
		if err != nil {
			return loaderReleaseBatchResult{}, err
		}
		latestPlatforms = append(latestPlatforms, latestPlatform{
			name:    platform.name,
			url:     platform.url,
			version: latest,
			exists:  exists,
		})
	}

	pending := make([]loaderReleasePublishConfig, 0, len(platforms))
	for _, latest := range latestPlatforms {
		if latest.exists {
			comparison, err := compareSemanticVersions(config.version, latest.version)
			if err != nil {
				return loaderReleaseBatchResult{}, fmt.Errorf("invalid published loader version %q: %w", latest.version, err)
			}
			if comparison < 0 {
				return loaderReleaseBatchResult{
					skippedPlatform: latest.name,
					latestVersion:   latest.version,
				}, nil
			}
			if comparison == 0 {
				continue
			}
		}
		pending = append(pending, loaderReleasePublishConfig{
			endpoint:  config.endpoint,
			apiKey:    config.apiKey,
			platform:  latest.name,
			version:   config.version,
			url:       latest.url,
			changelog: config.changelog,
			client:    client,
		})
	}

	result := loaderReleaseBatchResult{published: make([]string, 0, len(pending))}
	for _, platform := range pending {
		if _, err := postLoaderRelease(ctx, platform, client); err != nil {
			return loaderReleaseBatchResult{}, err
		}
		result.published = append(result.published, platform.platform)
	}
	return result, nil
}

func postLoaderRelease(ctx context.Context, config loaderReleasePublishConfig, client *http.Client) (bool, error) {
	requestBody := loaderReleasePublishRequest{
		Platform: config.platform,
		Version:  config.version,
		URL:      config.url,
	}
	if config.changelog != "" {
		requestBody.Changelog = &config.changelog
	}
	encodedBody, err := json.Marshal(requestBody)
	if err != nil {
		return false, fmt.Errorf("encode loader release request: %w", err)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, config.endpoint, bytes.NewReader(encodedBody))
	if err != nil {
		return false, fmt.Errorf("create loader release request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("User-Agent", "unbound-loader-release-publisher/1.0")
	request.Header.Set("X-API-Key", config.apiKey)

	response, err := client.Do(request)
	if err != nil {
		return false, fmt.Errorf("publish %s loader release %s: %w", config.platform, config.version, err)
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(response.Body, 16*1024))
	if err != nil {
		return false, fmt.Errorf("read loader release API response: %w", err)
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return false, fmt.Errorf("loader release API returned HTTP %d", response.StatusCode)
	}

	var published loaderReleasePublishResponse
	if err := json.Unmarshal(responseBody, &published); err != nil {
		return false, fmt.Errorf("decode loader release API response: %w", err)
	}
	if published.Platform != config.platform || published.Version != config.version || published.URL != config.url {
		return false, errors.New("loader release API response does not match the published release")
	}
	return true, nil
}

func latestLoaderReleaseVersion(ctx context.Context, endpoint string, platform string, client *http.Client) (string, bool, error) {
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return "", false, fmt.Errorf("parse loader release API URL: %w", err)
	}
	if !strings.HasSuffix(parsed.Path, "/releases") {
		return "", false, errors.New("loader release API URL must end in /releases")
	}
	parsed.Path = strings.TrimSuffix(parsed.Path, "/releases") + "/updates"
	parsed.RawPath = ""
	query := parsed.Query()
	query.Set("platform", platform)
	query.Set("version", "0.0.0")
	parsed.RawQuery = query.Encode()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return "", false, fmt.Errorf("create latest loader release request: %w", err)
	}
	request.Header.Set("User-Agent", "unbound-loader-release-publisher/1.0")
	response, err := client.Do(request)
	if err != nil {
		return "", false, fmt.Errorf("read latest %s loader release: %w", platform, err)
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(response.Body, 16*1024))
	if err != nil {
		return "", false, fmt.Errorf("read latest loader release response: %w", err)
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return "", false, fmt.Errorf("latest loader release API returned HTTP %d", response.StatusCode)
	}
	var latest loaderLatestUpdateResponse
	if err := json.Unmarshal(responseBody, &latest); err != nil {
		return "", false, fmt.Errorf("decode latest loader release response: %w", err)
	}
	if latest.Update == nil {
		return "", false, nil
	}
	if latest.Update.Version == "" {
		return "", false, errors.New("latest loader release response omitted its version")
	}
	return latest.Update.Version, true, nil
}

func validateHTTPURL(value string) error {
	parsed, err := url.Parse(value)
	if err != nil {
		return err
	}
	if (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Host == "" || strings.Contains(value, " ") {
		return errors.New("expected an absolute HTTP(S) URL")
	}
	return nil
}
