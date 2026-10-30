package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

type dkryptArtifact struct {
	ID           string `json:"id"`
	BundleID     string `json:"bundleId"`
	Channel      string `json:"channel"`
	VersionLabel string `json:"versionLabel"`
	BuildNumber  string `json:"buildNumber"`
	CreatedAt    string `json:"createdAt"`
	FileURL      string `json:"fileUrl"`
	SHA256       string `json:"sha256"`
}

type compatFetch struct {
	android bool
	ios     bool
}

type compatBuilds struct {
	ipa            string
	apk            string
	androidVersion string
}

var unsafeCacheName = regexp.MustCompile(`[^A-Za-z0-9._-]+`)

func defaultCompatCache() string {
	if directory := os.Getenv("ASTRAL_DISCORD_CACHE"); directory != "" {
		return directory
	}
	if directory, err := os.UserCacheDir(); err == nil {
		return filepath.Join(directory, "astral", "discord")
	}
	return filepath.Join(os.TempDir(), "astral-discord")
}

func iosSourceForChannel(channel string) string {
	switch channel {
	case "stable":
		return "appstore"
	case "beta":
		return "testflight"
	default:
		return ""
	}
}

func fetchCompatBuilds(ctx context.Context, channel, cache string, wanted compatFetch) (compatBuilds, error) {
	if discordAndroidChannelRank(channel) < 0 {
		return compatBuilds{}, fmt.Errorf("compat-scan fetches builds for stable, beta or alpha, not %q", channel)
	}
	var builds compatBuilds
	if wanted.android {
		apk, version, err := cachedAndroidBuild(ctx, channel, filepath.Join(cache, "android", channel))
		if err != nil {
			return compatBuilds{}, fmt.Errorf("Android %s build: %w", channel, err)
		}
		builds.apk, builds.androidVersion = apk, version
	}
	if !wanted.ios {
		return builds, nil
	}
	source := iosSourceForChannel(channel)
	if source == "" {
		fmt.Fprintf(os.Stderr, "compat-scan: Discord ships no iOS %s build, scanning Android only\n", channel)
		return builds, nil
	}
	apiKey := dkryptAPIKey()
	if apiKey == "" {
		fmt.Fprintln(os.Stderr, "compat-scan: DKRYPT_API_KEY is not set, scanning Android only")
		return builds, nil
	}
	ipa, err := cachedIOSBuild(ctx, envOr("DKRYPT_BASE_URL", defaultDkryptURL), apiKey, source, filepath.Join(cache, "ios", source))
	if err != nil {
		return compatBuilds{}, fmt.Errorf("iOS %s build: %w", source, err)
	}
	builds.ipa = ipa
	return builds, nil
}

func cachedAndroidBuild(ctx context.Context, channel, cache string) (string, string, error) {
	sources := discordAPKSources{
		sniffURL:   strings.TrimRight(envOr("DISCORD_SNIFF_URL", defaultSniffURL), "/"),
		trackerURL: strings.TrimRight(envOr("DISCORD_TRACKER", defaultAndroidTracker), "/"),
		client:     &http.Client{Timeout: discordAPKLookupLimit},
	}
	code, err := sources.latestCode(ctx, channel)
	if err != nil {
		return "", "", err
	}
	release, err := newDiscordAPKRelease(channel, code)
	if err != nil {
		return "", "", err
	}
	directory := filepath.Join(cache, fmt.Sprint(code))
	path := filepath.Join(directory, "base.apk")
	defer pruneCacheExcept(cache, fmt.Sprint(code))
	if _, err := verifyDiscordSplit(path, code); err == nil {
		fmt.Fprintf(os.Stderr, "compat-scan: using cached Android %s %s\n", channel, release.Version)
		return path, release.Version, nil
	}
	if err := os.MkdirAll(directory, 0o755); err != nil {
		return "", "", err
	}
	fmt.Fprintf(os.Stderr, "compat-scan: downloading Android %s %s\n", channel, release.Version)
	endpoint := sources.splitURLs(ctx, channel, code, []string{"base"})["base"]
	partial := path + ".part"
	defer os.Remove(partial)
	if _, err := downloadDiscordSplit(ctx, &http.Client{Timeout: discordAPKDownloadLimit}, endpoint, partial, code); err != nil {
		return "", "", err
	}
	if err := os.Rename(partial, path); err != nil {
		return "", "", err
	}
	return path, release.Version, nil
}

func pruneCacheExcept(directory, keep string) {
	entries, err := os.ReadDir(directory)
	if err != nil {
		return
	}
	for _, entry := range entries {
		if entry.Name() != keep {
			os.RemoveAll(filepath.Join(directory, entry.Name()))
		}
	}
}

func cachedIOSBuild(ctx context.Context, baseURL, apiKey, source, cache string) (string, error) {
	base := strings.TrimRight(baseURL, "/")
	body, status, err := fetchResponse(ctx, &http.Client{Timeout: discordAPKLookupLimit}, base+"/v1/artifacts", apiKey, nil)
	if err != nil {
		return "", fmt.Errorf("list dkrypt artifacts: %w", err)
	}
	if status != http.StatusOK {
		return "", fmt.Errorf("list dkrypt artifacts returned HTTP %d", status)
	}
	artifact, err := latestDkryptArtifact(body, defaultBundleID, source)
	if err != nil {
		return "", err
	}
	name := unsafeCacheName.ReplaceAllString(fmt.Sprintf("%s-%s-%s.ipa", source, artifact.VersionLabel, artifact.BuildNumber), "_")
	path := filepath.Join(cache, name)
	defer pruneCacheExcept(cache, name)
	if matchesSHA256(path, artifact.SHA256) {
		fmt.Fprintf(os.Stderr, "compat-scan: using cached iOS %s %s (%s)\n", source, artifact.VersionLabel, artifact.BuildNumber)
		return path, nil
	}
	fmt.Fprintf(os.Stderr, "compat-scan: downloading iOS %s %s (%s)\n", source, artifact.VersionLabel, artifact.BuildNumber)
	if err := downloadDirect(dkryptFileURL(base, artifact.FileURL), apiKey, path); err != nil {
		return "", err
	}
	if !matchesSHA256(path, artifact.SHA256) {
		os.Remove(path)
		return "", fmt.Errorf("the downloaded IPA does not match dkrypt's SHA-256 for %s", artifact.ID)
	}
	return path, nil
}

func latestDkryptArtifact(body []byte, bundleID, channel string) (dkryptArtifact, error) {
	var listing struct {
		Artifacts []dkryptArtifact `json:"artifacts"`
	}
	if err := json.Unmarshal(body, &listing); err != nil {
		return dkryptArtifact{}, fmt.Errorf("decode dkrypt artifacts: %w", err)
	}
	matches := []dkryptArtifact{}
	for _, artifact := range listing.Artifacts {
		if artifact.BundleID == bundleID && artifact.Channel == channel && artifact.FileURL != "" && artifact.SHA256 != "" {
			matches = append(matches, artifact)
		}
	}
	if len(matches) == 0 {
		return dkryptArtifact{}, fmt.Errorf("dkrypt has no %s artifact for %s", channel, bundleID)
	}
	sort.SliceStable(matches, func(left, right int) bool { return matches[left].CreatedAt > matches[right].CreatedAt })
	return matches[0], nil
}

func dkryptFileURL(base, fileURL string) string {
	if strings.HasPrefix(fileURL, "http://") || strings.HasPrefix(fileURL, "https://") {
		return fileURL
	}
	return base + "/" + strings.TrimLeft(fileURL, "/")
}

func dkryptAPIKey() string {
	return strings.TrimSpace(os.Getenv("DKRYPT_API_KEY"))
}

func matchesSHA256(path, expected string) bool {
	file, err := os.Open(path)
	if err != nil {
		return false
	}
	defer file.Close()
	digest := sha256.New()
	if _, err := io.Copy(digest, file); err != nil {
		return false
	}
	return strings.EqualFold(hex.EncodeToString(digest.Sum(nil)), expected)
}

var errNoCompatTarget = errors.New("usage: compat-scan (--ipa <path> | --apk <path>... | --channel <stable|beta|alpha>) [--android-version <v>] [--baseline <json>] [--results <json>] [--report <md>]")
