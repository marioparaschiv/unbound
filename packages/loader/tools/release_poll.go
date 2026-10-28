package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const (
	defaultItunesLookupURL  = "https://itunes.apple.com/lookup"
	defaultAndroidTracker   = "https://tracker.vendetta.rocks/tracker"
	defaultGithubAPI        = "https://api.github.com"
	releasePollUserAgent    = "unbound-loader-release-poll/1.0"
	releasePollRequestLimit = 45 * time.Second
)

type releasePollConfig struct {
	channel           string
	bundleID          string
	itunesLookupURL   string
	androidTrackerURL string
	sniffURL          string
	githubAPIURL      string
	githubRepository  string
	testflightVersion string
	githubToken       string
	httpClient        *http.Client
	now               func() time.Time
}

type releaseCandidate struct {
	Version     string
	AndroidCode int
}

var releaseCandidateChannels = []string{"stable", "testflight", "android-beta", "android-alpha"}

func isReleaseCandidateChannel(channel string) bool {
	for _, known := range releaseCandidateChannels {
		if known == channel {
			return true
		}
	}
	return false
}

type itunesLookupResponse struct {
	ResultCount int                  `json:"resultCount"`
	Results     []itunesLookupResult `json:"results"`
}

type itunesLookupResult struct {
	Version  string `json:"version"`
	BundleID string `json:"bundleId"`
	TrackID  int    `json:"trackId"`
}

type androidTrackerIndex struct {
	Latest struct {
		Stable json.RawMessage `json:"stable"`
	} `json:"latest"`
}

func runReleaseCandidate(args []string) error {
	set := flag.NewFlagSet("release-candidate", flag.ContinueOnError)
	channel := set.String("channel", "", "stable, testflight, android-beta or android-alpha")
	bundleID := set.String("bundle-id", defaultBundleID, "Discord bundle identifier")
	itunesURL := set.String("itunes-url", defaultItunesLookupURL, "iTunes Lookup endpoint")
	androidTrackerURL := set.String("android-tracker", defaultAndroidTracker, "Android package tracker base URL")
	sniffURL := set.String("sniff-url", envOr("DISCORD_SNIFF_URL", defaultSniffURL), "sniff service base URL")
	testflightVersion := set.String("version", "", "TestFlight version_build the dkrypt action resolved")
	githubAPIURL := set.String("github-api-url", defaultGithubAPI, "GitHub API base URL")
	githubRepository := set.String("github-repository", os.Getenv("GITHUB_REPOSITORY"), "GitHub owner/repository")
	if err := set.Parse(args); err != nil {
		return err
	}
	if !isReleaseCandidateChannel(*channel) {
		return errors.New("usage: release-candidate --channel <stable|testflight|android-beta|android-alpha>")
	}
	if *githubRepository == "" || os.Getenv("GITHUB_TOKEN") == "" {
		return errors.New("GITHUB_REPOSITORY and GITHUB_TOKEN are required")
	}

	config := releasePollConfig{
		channel:           *channel,
		bundleID:          *bundleID,
		itunesLookupURL:   *itunesURL,
		androidTrackerURL: strings.TrimRight(*androidTrackerURL, "/"),
		sniffURL:          strings.TrimRight(*sniffURL, "/"),
		githubAPIURL:      strings.TrimRight(*githubAPIURL, "/"),
		githubRepository:  *githubRepository,
		testflightVersion: strings.TrimSpace(*testflightVersion),
		githubToken:       os.Getenv("GITHUB_TOKEN"),
		httpClient:        &http.Client{Timeout: releasePollRequestLimit},
		now:               time.Now,
	}

	candidate, err := discoverReleaseCandidate(context.Background(), config)
	if err != nil {
		return err
	}
	if version := candidate.Version; version != "" {
		tag := loaderReleaseTag(config.channel, version)
		exists, err := githubReleaseExists(context.Background(), config.httpClient, config.githubAPIURL, config.githubRepository, tag, config.githubToken)
		if err != nil {
			return err
		}
		if exists {
			fmt.Printf("::notice title=release poll::%s already exists; no build is needed\n", tag)
			candidate = releaseCandidate{}
		} else {
			fmt.Printf("::notice title=release poll::new %s candidate: %s\n", config.channel, version)
		}
	} else {
		fmt.Printf("::notice title=release poll::no %s candidate is available\n", config.channel)
	}
	return writeReleaseCandidateOutput(os.Getenv("GITHUB_OUTPUT"), candidate)
}

func discoverReleaseCandidate(ctx context.Context, config releasePollConfig) (releaseCandidate, error) {
	if channel, android := strings.CutPrefix(config.channel, "android-"); android {
		return discoverAndroidChannelCandidate(ctx, config, channel)
	}
	if config.channel == "testflight" {
		return testflightCandidate(config.testflightVersion)
	}
	lookup, err := lookupItunesApp(ctx, config.httpClient, config.itunesLookupURL, config.bundleID)
	if err != nil {
		return releaseCandidate{}, err
	}
	version, err := discoverStableCandidate(ctx, config, lookup.Version)
	return releaseCandidate{Version: version}, err
}

func loaderReleaseTag(channel, version string) string {
	switch channel {
	case "stable":
		return releaseTag(version, "ios")
	case "testflight":
		return releaseTag(version, "ios-testflight")
	}
	return "discord-" + version
}

var testflightVersionPattern = regexp.MustCompile(`^[0-9]+(\.[0-9]+)+_[0-9]+$`)

func testflightCandidate(version string) (releaseCandidate, error) {
	if !testflightVersionPattern.MatchString(version) {
		return releaseCandidate{}, fmt.Errorf("release-candidate --channel testflight needs --version <version>_<build> from the dkrypt action, got %q", version)
	}
	return releaseCandidate{Version: version}, nil
}

func discoverAndroidChannelCandidate(ctx context.Context, config releasePollConfig, channel string) (releaseCandidate, error) {
	sources := discordAPKSources{sniffURL: config.sniffURL, trackerURL: config.androidTrackerURL, client: config.httpClient}
	code, err := sources.latestCode(ctx, channel)
	if err != nil {
		return releaseCandidate{}, err
	}
	release, err := newDiscordAPKRelease(channel, code)
	if err != nil {
		return releaseCandidate{}, err
	}
	if _, err := sources.sniffSplitURLs(ctx, channel, code); err != nil {
		available, trackerErr := verifyAndroidBasePackage(ctx, config.httpClient, config.androidTrackerURL, code)
		if trackerErr != nil {
			return releaseCandidate{}, errors.Join(err, trackerErr)
		}
		if !available {
			fmt.Printf("::notice title=release poll::Android %s version %d is not downloadable; no release is available\n", channel, code)
			return releaseCandidate{}, nil
		}
	}
	fmt.Printf("::notice title=release poll::Android %s is %s (version code %d)\n", channel, release.Version, code)
	return releaseCandidate{Version: release.ReleaseVersion, AndroidCode: code}, nil
}

func lookupItunesApp(ctx context.Context, client *http.Client, endpoint, bundleID string) (itunesLookupResult, error) {
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return itunesLookupResult{}, fmt.Errorf("parse iTunes Lookup URL: %w", err)
	}
	query := parsed.Query()
	query.Set("bundleId", bundleID)
	query.Set("country", "us")
	parsed.RawQuery = query.Encode()
	body, status, err := fetchResponse(ctx, client, parsed.String(), "", nil)
	if err != nil {
		return itunesLookupResult{}, err
	}
	if status != http.StatusOK {
		return itunesLookupResult{}, fmt.Errorf("iTunes Lookup returned HTTP %d", status)
	}
	var response itunesLookupResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return itunesLookupResult{}, fmt.Errorf("decode iTunes Lookup response: %w", err)
	}
	if response.ResultCount < 1 || len(response.Results) == 0 {
		return itunesLookupResult{}, fmt.Errorf("iTunes Lookup returned no results for %s", bundleID)
	}
	result := response.Results[0]
	if result.BundleID != bundleID || result.Version == "" || result.TrackID < 1 {
		return itunesLookupResult{}, errors.New("iTunes Lookup returned incomplete Discord metadata")
	}
	return result, nil
}

func discoverStableCandidate(ctx context.Context, config releasePollConfig, itunesVersion string) (string, error) {
	iosCode, err := androidCodeForDiscordVersion(itunesVersion)
	if err != nil {
		return "", fmt.Errorf("map iTunes version %q to an Android version code: %w", itunesVersion, err)
	}
	androidCode, err := lookupAndroidStable(ctx, config.httpClient, config.androidTrackerURL)
	if err != nil {
		return "", err
	}
	candidateCode := androidCode
	if iosCode < candidateCode {
		candidateCode = iosCode
	}
	version, err := discordVersionForAndroidCode(candidateCode)
	if err != nil {
		return "", err
	}
	available, err := verifyAndroidBasePackage(ctx, config.httpClient, config.androidTrackerURL, candidateCode)
	if err != nil {
		return "", err
	}
	if !available {
		fmt.Printf("::notice title=release poll::Android version %d is not downloadable; no common release is available\n", candidateCode)
		return "", nil
	}
	fmt.Printf("::notice title=release poll::iTunes stable %s, Android stable %d, selecting common version %s\n", itunesVersion, androidCode, version)
	return version, nil
}

func lookupAndroidStable(ctx context.Context, client *http.Client, trackerURL string) (int, error) {
	body, status, err := fetchResponse(ctx, client, strings.TrimRight(trackerURL, "/")+"/index", "", nil)
	if err != nil {
		return 0, err
	}
	if status != http.StatusOK {
		return 0, fmt.Errorf("Android version tracker returned HTTP %d", status)
	}
	var response androidTrackerIndex
	if err := json.Unmarshal(body, &response); err != nil {
		return 0, fmt.Errorf("decode Android version tracker response: %w", err)
	}
	code, err := parseAndroidCode(response.Latest.Stable)
	if err != nil {
		return 0, fmt.Errorf("read latest Android stable version: %w", err)
	}
	return code, nil
}

func parseAndroidCode(value json.RawMessage) (int, error) {
	if len(value) == 0 {
		return 0, errors.New("tracker has no latest stable version")
	}
	var text string
	if value[0] == '"' {
		if err := json.Unmarshal(value, &text); err != nil {
			return 0, err
		}
	} else {
		text = string(value)
	}
	code, err := strconv.Atoi(text)
	if err != nil || code < 1000 {
		return 0, fmt.Errorf("invalid Android version code %q", text)
	}
	return code, nil
}

func verifyAndroidBasePackage(ctx context.Context, client *http.Client, trackerURL string, code int) (bool, error) {
	endpoint := fmt.Sprintf("%s/download/%d/base", strings.TrimRight(trackerURL, "/"), code)
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return false, err
	}
	request.Header.Set("Range", "bytes=0-0")
	request.Header.Set("User-Agent", releasePollUserAgent)
	response, err := client.Do(request)
	if err != nil {
		return false, fmt.Errorf("check Android version %d availability: %w", code, err)
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusNotFound {
		return false, nil
	}
	if response.StatusCode != http.StatusPartialContent && response.StatusCode != http.StatusOK {
		return false, fmt.Errorf("Android version %d is unavailable from the tracker (HTTP %d)", code, response.StatusCode)
	}
	_, err = io.Copy(io.Discard, io.LimitReader(response.Body, 1))
	if err != nil {
		return false, fmt.Errorf("read Android version %d availability response: %w", code, err)
	}
	return true, nil
}

func fetchResponse(ctx context.Context, client *http.Client, endpoint, apiKey string, headers map[string]string) ([]byte, int, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, 0, err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("User-Agent", releasePollUserAgent)
	if apiKey != "" {
		request.Header.Set("Authorization", "Bearer "+apiKey)
	}
	for key, value := range headers {
		request.Header.Set(key, value)
	}
	response, err := client.Do(request)
	if err != nil {
		return nil, 0, err
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if err != nil {
		return nil, response.StatusCode, err
	}
	return body, response.StatusCode, nil
}

func githubReleaseExists(ctx context.Context, client *http.Client, apiURL, repository, tag, token string) (bool, error) {
	parts := strings.Split(repository, "/")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return false, fmt.Errorf("invalid GitHub repository %q", repository)
	}
	endpoint := strings.TrimRight(apiURL, "/") + "/repos/" + parts[0] + "/" + parts[1] + "/releases/tags/" + url.PathEscape(tag)
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return false, err
	}
	request.Header.Set("Accept", "application/vnd.github+json")
	request.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	request.Header.Set("User-Agent", releasePollUserAgent)
	request.Header.Set("Authorization", "Bearer "+token)
	response, err := client.Do(request)
	if err != nil {
		return false, err
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusNotFound {
		return false, nil
	}
	if response.StatusCode != http.StatusOK {
		return false, fmt.Errorf("GitHub release lookup for %s returned HTTP %d", tag, response.StatusCode)
	}
	return true, nil
}

func writeReleaseCandidateOutput(outputPath string, candidate releaseCandidate) error {
	values := map[string]string{"version": candidate.Version}
	lines := "version=" + candidate.Version + "\n"
	if candidate.AndroidCode != 0 {
		values["android_code"] = strconv.Itoa(candidate.AndroidCode)
		lines += "android_code=" + values["android_code"] + "\n"
	}
	if outputPath == "" {
		return json.NewEncoder(os.Stdout).Encode(values)
	}
	file, err := os.OpenFile(outputPath, os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return fmt.Errorf("open GitHub Actions output: %w", err)
	}
	defer file.Close()
	if _, err := file.WriteString(lines); err != nil {
		return fmt.Errorf("write GitHub Actions output: %w", err)
	}
	return nil
}

func envOr(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
