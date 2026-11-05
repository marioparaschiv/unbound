package main

import (
	"archive/zip"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

const (
	androidBuildsPath       = "/api/v1/loader/android-builds"
	androidBuildRecordName  = "build.json"
	lspatchOriginEntry      = "assets/lspatch/origin.apk"
	androidBuildContentType = "application/gzip"
)

var (
	androidBuildCommit  = regexp.MustCompile(`^[0-9a-f]{40}$`)
	androidBuildChannel = regexp.MustCompile(`^(stable|beta|alpha)$`)
	discordVersionName  = regexp.MustCompile(`^(\d{1,4}\.\d{1,4})\b`)
)

// androidBuildRecord mirrors publishAndroidBuildRequestSchema in packages/contracts/src/android-builds.ts.
type androidBuildRecord struct {
	Channel            string              `json:"channel"`
	DiscordVersion     string              `json:"discordVersion"`
	DiscordVersionCode int                 `json:"discordVersionCode"`
	Commit             string              `json:"commit"`
	Splits             []androidBuildSplit `json:"splits"`
}

type androidBuildSplit struct {
	Name           string `json:"name"`
	SHA256         string `json:"sha256"`
	Size           int64  `json:"size"`
	CompressedSize int64  `json:"compressedSize"`
	Key            string `json:"key"`
	path           string
}

func runPublishAndroidBuild(args []string) error {
	set := flag.NewFlagSet("publish-android-build", flag.ContinueOnError)
	apks := set.String("apks", "", "patched Discord .apks bundle")
	var extra stringList
	set.Var(&extra, "split", "another patched split APK to publish beside the bundle's (repeatable)")
	channel := set.String("channel", "", "stable, beta or alpha")
	commit := set.String("commit", "", "repository commit the loader was built from")
	workDir := set.String("work-dir", "", "directory for the gzipped splits (default: a temporary directory)")
	apiURL := set.String("api-url", envOr("UNBOUND_API_URL", "https://unbound.rip"), "backend base URL")
	dryRun := set.Bool("dry-run", false, "stage and print the build without uploading or publishing it")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *apks == "" || !androidBuildChannel.MatchString(*channel) || !androidBuildCommit.MatchString(*commit) {
		return errors.New("usage: publish-android-build --apks <path> --channel <stable|beta|alpha> --commit <sha> [--split <apk>...] [--work-dir <dir>] [--dry-run]")
	}
	directory := *workDir
	if directory == "" {
		temporary, err := os.MkdirTemp("", "android-build-")
		if err != nil {
			return err
		}
		defer os.RemoveAll(temporary)
		directory = temporary
	}
	record, err := stageAndroidBuild(*apks, extra, directory, *channel, *commit)
	if err != nil {
		return err
	}
	encoded, err := json.MarshalIndent(record, "", "\t")
	if err != nil {
		return err
	}
	if *dryRun {
		fmt.Println(string(encoded))
		return nil
	}
	bucket, configured, err := s3BucketFromEnv()
	if err != nil {
		return err
	}
	if !configured {
		return errors.New("S3_PUBLIC_BUCKET is not set; nowhere to upload the splits")
	}
	apiKey := os.Getenv("UNBOUND_API_KEY")
	if apiKey == "" {
		return errors.New("UNBOUND_API_KEY is required to record the build")
	}
	ctx := context.Background()
	if err := uploadAndroidBuild(ctx, bucket, record, directory, encoded); err != nil {
		return err
	}
	return postAndroidBuild(ctx, &http.Client{Timeout: time.Minute}, strings.TrimRight(*apiURL, "/")+androidBuildsPath, apiKey, encoded)
}

// stageAndroidBuild gzips every split of the bundle and extras into directory and describes them.
func stageAndroidBuild(apks string, extras []string, directory, channel, commit string) (androidBuildRecord, error) {
	paths, err := extractAPKs(apks, directory)
	if err != nil {
		return androidBuildRecord{}, err
	}
	paths = append(paths, extras...)
	record := androidBuildRecord{Channel: channel, Commit: commit}
	seen := map[string]bool{}
	for _, path := range paths {
		manifest, err := readAPKManifest(path)
		if err != nil {
			return androidBuildRecord{}, fmt.Errorf("Failed to read the manifest of %s: %w", path, err)
		}
		if manifest.Package != discordAndroidPackage || manifest.VersionCode != patchedAPKVersionCode {
			return androidBuildRecord{}, fmt.Errorf("%s is %s versionCode %d, not a patched Discord split", path, manifest.Package, manifest.VersionCode)
		}
		name := manifest.Split
		if name == "" {
			name = "base"
			if err := describeDiscordBase(path, manifest, &record); err != nil {
				return androidBuildRecord{}, err
			}
		}
		if seen[name] {
			return androidBuildRecord{}, fmt.Errorf("split %s appears twice", name)
		}
		seen[name] = true
		split, err := gzipSplit(path, filepath.Join(directory, name+".apk.gz"))
		if err != nil {
			return androidBuildRecord{}, fmt.Errorf("Failed to compress split %s: %w", name, err)
		}
		split.Name = name
		record.Splits = append(record.Splits, split)
	}
	if !seen["base"] {
		return androidBuildRecord{}, errors.New("the build has no base APK")
	}
	sort.Slice(record.Splits, func(left, right int) bool { return record.Splits[left].Name < record.Splits[right].Name })
	for index := range record.Splits {
		record.Splits[index].Key = androidBuildPrefix(record) + "/" + record.Splits[index].Name + ".apk.gz"
	}
	return record, nil
}

func androidBuildPrefix(record androidBuildRecord) string {
	return fmt.Sprintf("android/%s/%d/%s", record.Channel, record.DiscordVersionCode, record.Commit)
}

// describeDiscordBase reads Discord's version name from the patched base and its real versionCode from the stock APK LSPatch stores inside it.
func describeDiscordBase(path string, manifest apkManifest, record *androidBuildRecord) error {
	match := discordVersionName.FindStringSubmatch(manifest.VersionName)
	if match == nil {
		return fmt.Errorf("unreadable Discord version name %q", manifest.VersionName)
	}
	record.DiscordVersion = match[1]
	archive, err := zip.OpenReader(path)
	if err != nil {
		return err
	}
	defer archive.Close()
	for _, file := range archive.File {
		if file.Name != lspatchOriginEntry {
			continue
		}
		if file.Method != zip.Store {
			return fmt.Errorf("%s is compressed", lspatchOriginEntry)
		}
		offset, err := file.DataOffset()
		if err != nil {
			return err
		}
		handle, err := os.Open(path)
		if err != nil {
			return err
		}
		defer handle.Close()
		origin, err := zip.NewReader(io.NewSectionReader(handle, offset, int64(file.CompressedSize64)), int64(file.CompressedSize64))
		if err != nil {
			return fmt.Errorf("Failed to open %s: %w", lspatchOriginEntry, err)
		}
		stock, err := zipAPKManifest(origin)
		if err != nil {
			return fmt.Errorf("Failed to read the manifest of %s: %w", lspatchOriginEntry, err)
		}
		record.DiscordVersionCode = stock.VersionCode
		return nil
	}
	return fmt.Errorf("%s has no %s; it is not an LSPatch build", path, lspatchOriginEntry)
}

func extractAPKs(apks, directory string) ([]string, error) {
	archive, err := zip.OpenReader(apks)
	if err != nil {
		return nil, err
	}
	defer archive.Close()
	var paths []string
	for _, file := range archive.File {
		name := filepath.Base(file.Name)
		if !strings.HasSuffix(name, ".apk") {
			continue
		}
		path := filepath.Join(directory, "source-"+name)
		if err := extractZipFile(file, path); err != nil {
			return nil, fmt.Errorf("Failed to extract %s: %w", file.Name, err)
		}
		paths = append(paths, path)
	}
	return paths, nil
}

func extractZipFile(file *zip.File, path string) error {
	reader, err := file.Open()
	if err != nil {
		return err
	}
	defer reader.Close()
	output, err := os.Create(path)
	if err != nil {
		return err
	}
	if _, err := io.Copy(output, reader); err != nil {
		output.Close()
		return err
	}
	return output.Close()
}

func gzipSplit(source, destination string) (androidBuildSplit, error) {
	input, err := os.Open(source)
	if err != nil {
		return androidBuildSplit{}, err
	}
	defer input.Close()
	output, err := os.Create(destination)
	if err != nil {
		return androidBuildSplit{}, err
	}
	defer output.Close()
	compressor, err := gzip.NewWriterLevel(output, gzip.BestCompression)
	if err != nil {
		return androidBuildSplit{}, err
	}
	hash := sha256.New()
	size, err := io.Copy(io.MultiWriter(compressor, hash), input)
	if err != nil {
		return androidBuildSplit{}, err
	}
	if err := compressor.Close(); err != nil {
		return androidBuildSplit{}, err
	}
	info, err := output.Stat()
	if err != nil {
		return androidBuildSplit{}, err
	}
	return androidBuildSplit{SHA256: hex.EncodeToString(hash.Sum(nil)), Size: size, CompressedSize: info.Size(), path: destination}, nil
}

// uploadAndroidBuild uploads every split, then build.json, so a build only looks complete once its splits are in place. A build already published is left alone.
func uploadAndroidBuild(ctx context.Context, bucket s3Bucket, record androidBuildRecord, directory string, encoded []byte) error {
	recordKey := androidBuildPrefix(record) + "/" + androidBuildRecordName
	published, err := bucket.exists(ctx, recordKey)
	if err != nil {
		return err
	}
	if published {
		fmt.Println(recordKey, "is already published; builds are never overwritten")
		return nil
	}
	for _, split := range record.Splits {
		if err := bucket.putFile(ctx, split.Key, split.path, androidBuildContentType); err != nil {
			return fmt.Errorf("Failed to upload split %s: %w", split.Name, err)
		}
		fmt.Println("uploaded", split.Key)
	}
	recordPath := filepath.Join(directory, androidBuildRecordName)
	if err := os.WriteFile(recordPath, encoded, 0o644); err != nil {
		return err
	}
	if err := bucket.putFile(ctx, recordKey, recordPath, "application/json"); err != nil {
		return fmt.Errorf("Failed to upload %s: %w", recordKey, err)
	}
	fmt.Println("uploaded", recordKey)
	return nil
}

// postAndroidBuild records the build with the backend so clients can list it. Posting the same build again replaces it.
func postAndroidBuild(ctx context.Context, client *http.Client, endpoint, apiKey string, encoded []byte) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(encoded))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("User-Agent", "unbound-android-build-publisher/1.0")
	request.Header.Set("X-API-Key", apiKey)
	response, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("Failed to record the Android build: %w", err)
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("Failed to record the Android build: HTTP %d: %s", response.StatusCode, strings.TrimSpace(string(body)))
	}
	fmt.Println("recorded the build at", endpoint)
	return nil
}
