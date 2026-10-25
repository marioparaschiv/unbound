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
	"sort"
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
	dkryptBaseURL     string
	githubAPIURL      string
	githubRepository  string
	dkryptAPIKey      string
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

type testflightTrainsResponse struct {
	Trains []testflightTrain `json:"trains"`
}

type testflightTrain struct {
	TrainVersion string `json:"trainVersion"`
}

type testflightBuildsResponse struct {
	Builds []testflightBuild `json:"builds"`
}

type testflightBuild struct {
	ID                   int64  `json:"id"`
	BundleID             string `json:"bundleId"`
	CFBundleShortVersion string `json:"cfBundleShortVersion"`
	CFBundleVersion      string `json:"cfBundleVersion"`
	Expiration           string `json:"expiration"`
}

func runReleaseCandidate(args []string) error {
	set := flag.NewFlagSet("release-candidate", flag.ContinueOnError)
	channel := set.String("channel", "", "stable, testflight, android-beta or android-alpha")
	bundleID := set.String("bundle-id", defaultBundleID, "Discord bundle identifier")
	itunesURL := set.String("itunes-url", defaultItunesLookupURL, "iTunes Lookup endpoint")
	androidTrackerURL := set.String("android-tracker", defaultAndroidTracker, "Android package tracker base URL")
	sniffURL := set.String("sniff-url", envOr("DISCORD_SNIFF_URL", defaultSniffURL), "sniff service base URL")
	dkryptBaseURL := set.String("dkrypt-base-url", envOr("DKRYPT_BASE_URL", defaultDkryptURL), "dkrypt service base URL")
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
		dkryptBaseURL:     strings.TrimRight(*dkryptBaseURL, "/"),
		githubAPIURL:      strings.TrimRight(*githubAPIURL, "/"),
		githubRepository:  *githubRepository,
		dkryptAPIKey:      os.Getenv("DKRYPT_API_KEY"),
		githubToken:       os.Getenv("GITHUB_TOKEN"),
		httpClient:        &http.Client{Timeout: releasePollRequestLimit},
		now:               time.Now,
	}

	candidate, err := discoverReleaseCandidate(context.Background(), config)
	if err != nil {
		return err
	}
	if version := candidate.Version; version != "" {
		tag := "loader-v" + version
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
	lookup, err := lookupItunesApp(ctx, config.httpClient, config.itunesLookupURL, config.bundleID)
	if err != nil {
		return releaseCandidate{}, err
	}
	var version string
	if config.channel == "stable" {
		version, err = discoverStableCandidate(ctx, config, lookup.Version)
	} else {
		version, err = discoverTestflightCandidate(ctx, config, lookup.TrackID)
	}
	return releaseCandidate{Version: version}, err
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

func discoverTestflightCandidate(ctx context.Context, config releasePollConfig, appID int) (string, error) {
	if config.dkryptAPIKey == "" {
		return "", errors.New("DKRYPT_API_KEY is required to poll TestFlight")
	}
	endpoint := fmt.Sprintf("%s/v1/testflight/%d/trains", config.dkryptBaseURL, appID)
	body, status, err := fetchResponse(ctx, config.httpClient, endpoint, config.dkryptAPIKey, nil)
	if err != nil {
		return "", err
	}
	if status != http.StatusOK {
		return "", fmt.Errorf("dkrypt TestFlight train lookup returned HTTP %d", status)
	}
	var response testflightTrainsResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return "", fmt.Errorf("decode dkrypt TestFlight train response: %w", err)
	}
	trains := append([]testflightTrain(nil), response.Trains...)
	sort.Slice(trains, func(i, j int) bool {
		return compareDiscordVersions(trains[i].TrainVersion, trains[j].TrainVersion) > 0
	})
	var selected *testflightBuild
	for _, train := range trains {
		builds, err := lookupTestflightBuilds(ctx, config, appID, train.TrainVersion)
		if err != nil {
			return "", err
		}
		for i := range builds {
			build := &builds[i]
			if !isAvailableTestflightBuild(*build, config.bundleID, config.now()) {
				continue
			}
			if selected == nil || newerTestflightBuild(*build, *selected) {
				selected = build
			}
		}
	}
	if selected == nil {
		return "", nil
	}
	return selected.CFBundleShortVersion + "_" + selected.CFBundleVersion, nil
}

func lookupTestflightBuilds(ctx context.Context, config releasePollConfig, appID int, trainVersion string) ([]testflightBuild, error) {
	endpoint, err := url.Parse(fmt.Sprintf("%s/v1/testflight/%d/builds", config.dkryptBaseURL, appID))
	if err != nil {
		return nil, err
	}
	query := endpoint.Query()
	query.Set("trainVersion", trainVersion)
	endpoint.RawQuery = query.Encode()
	body, status, err := fetchResponse(ctx, config.httpClient, endpoint.String(), config.dkryptAPIKey, nil)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("dkrypt TestFlight build lookup for %s returned HTTP %d", trainVersion, status)
	}
	var response testflightBuildsResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("decode dkrypt TestFlight build response for %s: %w", trainVersion, err)
	}
	return response.Builds, nil
}

func isAvailableTestflightBuild(build testflightBuild, bundleID string, now time.Time) bool {
	if build.ID < 1 || build.BundleID != bundleID || build.CFBundleShortVersion == "" || build.CFBundleVersion == "" {
		return false
	}
	if _, err := strconv.ParseUint(build.CFBundleVersion, 10, 64); err != nil {
		return false
	}
	if build.Expiration == "" {
		return true
	}
	expiration, err := time.Parse(time.RFC3339, build.Expiration)
	return err == nil && expiration.After(now)
}

func newerTestflightBuild(candidate, current testflightBuild) bool {
	versionOrder := compareDiscordVersions(candidate.CFBundleShortVersion, current.CFBundleShortVersion)
	if versionOrder != 0 {
		return versionOrder > 0
	}
	candidateBuild, candidateErr := strconv.ParseUint(candidate.CFBundleVersion, 10, 64)
	currentBuild, currentErr := strconv.ParseUint(current.CFBundleVersion, 10, 64)
	return candidateErr == nil && currentErr == nil && candidateBuild > currentBuild
}

func compareDiscordVersions(left, right string) int {
	left = strings.TrimPrefix(strings.TrimSpace(strings.SplitN(left, "_", 2)[0]), "v")
	right = strings.TrimPrefix(strings.TrimSpace(strings.SplitN(right, "_", 2)[0]), "v")
	leftParts := strings.Split(left, ".")
	rightParts := strings.Split(right, ".")
	length := len(leftParts)
	if len(rightParts) > length {
		length = len(rightParts)
	}
	for i := 0; i < length; i++ {
		var leftPart, rightPart uint64
		if i < len(leftParts) {
			leftPart, _ = strconv.ParseUint(leftParts[i], 10, 64)
		}
		if i < len(rightParts) {
			rightPart, _ = strconv.ParseUint(rightParts[i], 10, 64)
		}
		if leftPart > rightPart {
			return 1
		}
		if leftPart < rightPart {
			return -1
		}
	}
	return 0
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
