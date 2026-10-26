package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	discordAndroidPackage   = "com.discord"
	defaultSniffURL         = "https://sniff.xhyrom.dev"
	discordAPKUserAgent     = "unbound-loader-discord-apk/1.0 (+https://github.com/marioparaschiv/unbound)"
	discordAPKLookupLimit   = 45 * time.Second
	discordAPKDownloadLimit = 30 * time.Minute
)

var discordAndroidChannels = []string{"stable", "beta", "alpha"}

type discordAPKSources struct {
	sniffURL   string
	trackerURL string
	client     *http.Client
}

type discordAPKRelease struct {
	Channel        string            `json:"channel"`
	Code           int               `json:"code"`
	Version        string            `json:"version"`
	ReleaseVersion string            `json:"releaseVersion"`
	VersionName    string            `json:"versionName,omitempty"`
	Files          map[string]string `json:"files,omitempty"`
}

type sniffDetailsResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Item struct {
			Details struct {
				AppDetails struct {
					VersionCode int `json:"version_code"`
				} `json:"app_details"`
			} `json:"details"`
		} `json:"item"`
	} `json:"data"`
	Error string `json:"error"`
}

type sniffDownloadResponse struct {
	Success bool `json:"success"`
	Data    struct {
		MainAPKURL string `json:"main_apk_url"`
		Splits     []struct {
			Name        string `json:"name"`
			DownloadURL string `json:"download_url"`
		} `json:"splits"`
	} `json:"data"`
	Error string `json:"error"`
}

func discordAndroidChannelRank(channel string) int {
	for rank, known := range discordAndroidChannels {
		if known == channel {
			return rank
		}
	}
	return -1
}

func discordAndroidVersion(code int) (string, string, error) {
	track := code % 1000 / 100
	if code < 1000 || track >= len(discordAndroidChannels) {
		return "", "", fmt.Errorf("invalid Android version code %d", code)
	}
	return fmt.Sprintf("%d.%d", code/1000, code%100), discordAndroidChannels[track], nil
}

func discordAndroidReleaseVersion(channel, version string) string {
	if channel == "stable" {
		return version
	}
	return version + "-android-" + channel
}

func newDiscordAPKRelease(channel string, code int) (discordAPKRelease, error) {
	version, _, err := discordAndroidVersion(code)
	if err != nil {
		return discordAPKRelease{}, err
	}
	return discordAPKRelease{Channel: channel, Code: code, Version: version, ReleaseVersion: discordAndroidReleaseVersion(channel, version)}, nil
}

func (sources discordAPKSources) latestCode(ctx context.Context, channel string) (int, error) {
	rank := discordAndroidChannelRank(channel)
	if rank < 0 {
		return 0, fmt.Errorf("unknown Discord Android channel %q", channel)
	}
	var failures []error
	best := 0
	consider := func(code int, err error) {
		if err != nil {
			failures = append(failures, err)
		} else if code > best {
			best = code
		}
	}
	tracker, trackerErr := sources.trackerIndex(ctx)
	for _, eligible := range discordAndroidChannels[:rank+1] {
		consider(sources.sniffCode(ctx, eligible))
		if trackerErr == nil {
			consider(parseTrackerCode(tracker, eligible))
		}
	}
	if trackerErr != nil {
		failures = append(failures, trackerErr)
	}
	if best == 0 {
		return 0, fmt.Errorf("no source knows Discord's Android %s version: %w", channel, errors.Join(failures...))
	}
	for _, failure := range failures {
		fmt.Fprintf(os.Stderr, "discord-apk: %v\n", failure)
	}
	return best, nil
}

func (sources discordAPKSources) sniffCode(ctx context.Context, channel string) (int, error) {
	endpoint := fmt.Sprintf("%s/v1/details/%s/%s", sources.sniffURL, discordAndroidPackage, channel)
	body, status, err := fetchResponse(ctx, sources.client, endpoint, "", map[string]string{"User-Agent": discordAPKUserAgent})
	if err != nil {
		return 0, fmt.Errorf("sniff %s details: %w", channel, err)
	}
	var response sniffDetailsResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return 0, fmt.Errorf("sniff %s details returned HTTP %d without JSON", channel, status)
	}
	if status != http.StatusOK || !response.Success {
		return 0, fmt.Errorf("sniff %s details returned HTTP %d: %s", channel, status, response.Error)
	}
	if response.Data.Item.Details.AppDetails.VersionCode < 1000 {
		return 0, fmt.Errorf("sniff %s details have no version code", channel)
	}
	return response.Data.Item.Details.AppDetails.VersionCode, nil
}

func (sources discordAPKSources) trackerIndex(ctx context.Context) (map[string]json.RawMessage, error) {
	body, status, err := fetchResponse(ctx, sources.client, sources.trackerURL+"/index", "", map[string]string{"User-Agent": discordAPKUserAgent})
	if err != nil {
		return nil, fmt.Errorf("Android version tracker: %w", err)
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("Android version tracker returned HTTP %d", status)
	}
	var response struct {
		Latest map[string]json.RawMessage `json:"latest"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("decode Android version tracker response: %w", err)
	}
	return response.Latest, nil
}

func parseTrackerCode(latest map[string]json.RawMessage, channel string) (int, error) {
	code, err := parseAndroidCode(latest[channel])
	if err != nil {
		return 0, fmt.Errorf("tracker %s version: %w", channel, err)
	}
	return code, nil
}

func (sources discordAPKSources) splitURLs(ctx context.Context, channel string, code int, splits []string) map[string]string {
	urls := map[string]string{}
	sniffed, err := sources.sniffSplitURLs(ctx, channel, code)
	if err != nil {
		fmt.Fprintf(os.Stderr, "discord-apk: %v, falling back to the tracker\n", err)
	}
	for _, split := range splits {
		if url := sniffed[split]; url != "" {
			urls[split] = url
		} else {
			urls[split] = fmt.Sprintf("%s/download/%d/%s", sources.trackerURL, code, split)
		}
	}
	return urls
}

func (sources discordAPKSources) sniffSplitURLs(ctx context.Context, channel string, code int) (map[string]string, error) {
	endpoint := fmt.Sprintf("%s/v1/download/%s/%s/%d", sources.sniffURL, discordAndroidPackage, channel, code)
	body, status, err := fetchResponse(ctx, sources.client, endpoint, "", map[string]string{"User-Agent": discordAPKUserAgent})
	if err != nil {
		return nil, fmt.Errorf("sniff %s download %d: %w", channel, code, err)
	}
	var response sniffDownloadResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("sniff %s download %d returned HTTP %d without JSON", channel, code, status)
	}
	if status != http.StatusOK || !response.Success || response.Data.MainAPKURL == "" {
		return nil, fmt.Errorf("sniff %s download %d returned HTTP %d: %s", channel, code, status, response.Error)
	}
	urls := map[string]string{"base": response.Data.MainAPKURL}
	for _, split := range response.Data.Splits {
		if split.Name != "" && split.DownloadURL != "" {
			urls[split.Name] = split.DownloadURL
		}
	}
	return urls, nil
}

func downloadDiscordSplit(ctx context.Context, client *http.Client, endpoint, output string, code int) (apkManifest, error) {
	var lastErr error
	for attempt := 1; attempt <= 3; attempt++ {
		if attempt > 1 {
			time.Sleep(time.Duration(1<<(attempt-2)) * time.Second)
		}
		retry, err := downloadDiscordSplitOnce(ctx, client, endpoint, output)
		if err == nil {
			return verifyDiscordSplit(output, code)
		}
		lastErr = err
		if !retry {
			break
		}
	}
	return apkManifest{}, lastErr
}

func downloadDiscordSplitOnce(ctx context.Context, client *http.Client, endpoint, output string) (bool, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return false, err
	}
	request.Header.Set("User-Agent", discordAPKUserAgent)
	response, err := client.Do(request)
	if err != nil {
		return true, fmt.Errorf("download %s: %s", filepath.Base(output), safeMessage(err))
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return retryableStatuses[response.StatusCode], fmt.Errorf("download %s returned HTTP %d", filepath.Base(output), response.StatusCode)
	}
	file, err := os.Create(output)
	if err != nil {
		return false, err
	}
	if _, err := io.Copy(file, response.Body); err != nil {
		file.Close()
		return true, fmt.Errorf("download %s: %s", filepath.Base(output), safeMessage(err))
	}
	return false, file.Close()
}

func verifyDiscordSplit(path string, code int) (apkManifest, error) {
	manifest, err := readAPKManifest(path)
	if err != nil {
		return apkManifest{}, fmt.Errorf("%s: %w", filepath.Base(path), err)
	}
	if manifest.Package != discordAndroidPackage {
		return apkManifest{}, fmt.Errorf("%s is %s, not %s", filepath.Base(path), manifest.Package, discordAndroidPackage)
	}
	if manifest.VersionCode != code {
		return apkManifest{}, fmt.Errorf("%s has version code %d, want %d", filepath.Base(path), manifest.VersionCode, code)
	}
	return manifest, nil
}

func runDiscordAPK(args []string) error {
	set := flag.NewFlagSet("discord-apk", flag.ContinueOnError)
	channel := set.String("channel", "", "stable, beta or alpha")
	code := set.Int("code", 0, "exact Android version code instead of the channel's latest")
	outputDir := set.String("output-dir", "", "download the APKs into this directory")
	var splits stringList
	set.Var(&splits, "split", "split to download, such as base or config.arm64_v8a (repeatable, defaults to base)")
	sniffURL := set.String("sniff-url", envOr("DISCORD_SNIFF_URL", defaultSniffURL), "sniff service base URL")
	trackerURL := set.String("android-tracker", envOr("DISCORD_TRACKER", defaultAndroidTracker), "Android package tracker base URL")
	device := set.String("device", "", "adb serial of a device to download every split it needs for, read from its Discord install or else its ABI, density and locale")
	install := set.Bool("install", false, "install the downloaded splits on --device with adb install-multiple -r -d, keeping app data")
	if err := set.Parse(args); err != nil {
		return err
	}
	if discordAndroidChannelRank(*channel) < 0 {
		return errors.New("usage: discord-apk --channel <stable|beta|alpha> [--code <code>] [--output-dir <dir> [--split <name>...] [--device <serial> [--install]]]")
	}
	if *install && *device == "" {
		return errors.New("discord-apk: --install needs --device")
	}
	if *device != "" && *outputDir == "" {
		return errors.New("discord-apk: --device needs --output-dir")
	}
	ctx := context.Background()
	var adb adbRunner
	if *device != "" {
		adb = adbForSerial(*device)
		needed, err := discordDeviceSplits(ctx, adb)
		if err != nil {
			return fmt.Errorf("read the splits %s needs: %w", *device, err)
		}
		splits = orderSplits(append(needed, splits...))
		fmt.Fprintf(os.Stderr, "discord-apk: %s needs %s\n", *device, strings.Join(splits, ", "))
	}
	sources := discordAPKSources{
		sniffURL:   strings.TrimRight(*sniffURL, "/"),
		trackerURL: strings.TrimRight(*trackerURL, "/"),
		client:     &http.Client{Timeout: discordAPKLookupLimit},
	}
	if *code == 0 {
		latest, err := sources.latestCode(ctx, *channel)
		if err != nil {
			return err
		}
		*code = latest
	}
	release, err := newDiscordAPKRelease(*channel, *code)
	if err != nil {
		return err
	}
	outputs := map[string]string{
		"channel":         release.Channel,
		"code":            fmt.Sprint(release.Code),
		"version":         release.Version,
		"release_version": release.ReleaseVersion,
	}
	if *outputDir != "" {
		if len(splits) == 0 {
			splits = stringList{"base"}
		}
		if err := os.MkdirAll(*outputDir, 0o755); err != nil {
			return err
		}
		release.Files = map[string]string{}
		downloads := &http.Client{Timeout: discordAPKDownloadLimit}
		for split, endpoint := range sources.splitURLs(ctx, release.Channel, release.Code, splits) {
			path := filepath.Join(*outputDir, split+".apk")
			manifest, err := downloadDiscordSplit(ctx, downloads, endpoint, path, release.Code)
			if err != nil {
				return err
			}
			release.Files[split] = path
			if split == "base" {
				release.VersionName = manifest.VersionName
				outputs["apk"] = path
				outputs["version_name"] = manifest.VersionName
			}
		}
	}
	if *install {
		if err := installDiscordSplits(ctx, adb, release.Files); err != nil {
			return err
		}
	}
	if err := writeOutputs(outputs); err != nil {
		return err
	}
	return json.NewEncoder(os.Stdout).Encode(release)
}

func safeMessage(value any) string {
	message := strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(fmt.Sprint(value), "\r", " "), "\n", " "))
	if len(message) > 500 {
		message = message[:500]
	}
	if message == "" || message == "<nil>" {
		return "unknown error"
	}
	return message
}
