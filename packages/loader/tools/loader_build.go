package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	loaderReleasesPath     = "/api/v1/loader/releases"
	loaderBuildRecordName  = "build.json"
	androidModulePackage   = "app.unbound.android"
	debContentType         = "application/vnd.debian.binary-package"
	androidAPKContentType  = "application/vnd.android.package-archive"
	loaderBuildBucketRoot  = "loader"
	loaderBuildUsageString = "usage: publish-loader-build --version <semver> --deb <path> --module <path> --commit <sha> [--changelog-file <path>] [--dry-run]"
)

// loaderBuildRecord is the build.json written last under loader/<version>/, so a version only looks complete once its assets are in place.
type loaderBuildRecord struct {
	Version string             `json:"version"`
	Commit  string             `json:"commit"`
	Assets  []loaderBuildAsset `json:"assets"`
}

type loaderBuildAsset struct {
	Platform    string `json:"platform"`
	Name        string `json:"name"`
	SHA256      string `json:"sha256"`
	Size        int64  `json:"size"`
	Key         string `json:"key"`
	URL         string `json:"url"`
	path        string
	contentType string
}

func runPublishLoaderBuild(args []string) error {
	set := flag.NewFlagSet("publish-loader-build", flag.ContinueOnError)
	version := set.String("version", "", "loader version the deb and the module carry")
	deb := set.String("deb", "", "iOS tweak package (.deb)")
	module := set.String("module", "", "Android Xposed module (.apk)")
	commit := set.String("commit", "", "repository commit the loader was built from")
	changelogFile := set.String("changelog-file", "", "path to the release changelog")
	cdnURL := set.String("cdn-url", os.Getenv("CDN_URL"), "public URL of the bucket")
	apiURL := set.String("api-url", envOr("UNBOUND_API_URL", "https://unbound.rip"), "backend base URL")
	dryRun := set.Bool("dry-run", false, "stage the build and check it against the published versions without uploading or publishing it")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *version == "" || *deb == "" || *module == "" || !androidBuildCommit.MatchString(*commit) {
		return errors.New(loaderBuildUsageString)
	}
	if err := validateHTTPURL(*cdnURL); err != nil {
		return fmt.Errorf("CDN_URL or --cdn-url must be the bucket's public URL: %w", err)
	}
	changelog := ""
	if *changelogFile != "" {
		contents, err := os.ReadFile(*changelogFile)
		if err != nil {
			return fmt.Errorf("Failed to read the loader changelog %s: %w", *changelogFile, err)
		}
		changelog = strings.TrimSpace(string(contents))
	}
	record, err := stageLoaderBuild(*version, *commit, *deb, *module, strings.TrimRight(*cdnURL, "/"))
	if err != nil {
		return err
	}
	encoded, err := json.MarshalIndent(record, "", "\t")
	if err != nil {
		return err
	}
	fmt.Println(string(encoded))

	ctx := context.Background()
	if !*dryRun {
		bucket, configured, err := s3BucketFromEnv()
		if err != nil {
			return err
		}
		if !configured {
			return errors.New("S3_PUBLIC_BUCKET is not set; nowhere to upload the loader")
		}
		if err := uploadLoaderBuild(ctx, bucket, record, encoded); err != nil {
			return err
		}
	}
	result, err := publishLoaderReleases(ctx, loaderReleaseBatchConfig{
		endpoint:   strings.TrimRight(*apiURL, "/") + loaderReleasesPath,
		apiKey:     os.Getenv("UNBOUND_API_KEY"),
		version:    record.Version,
		iosURL:     record.Assets[0].URL,
		androidURL: record.Assets[1].URL,
		changelog:  changelog,
		client:     lookupClient(30 * time.Second),
		dryRun:     *dryRun,
	})
	if err != nil {
		return err
	}
	switch {
	case result.skippedPlatform != "":
		fmt.Printf("Skipped loader %s because it is older than %s loader %s\n", record.Version, result.skippedPlatform, result.latestVersion)
	case len(result.published) == 0:
		fmt.Printf("Skipped loader %s because it is already published\n", record.Version)
	case *dryRun:
		fmt.Printf("Would publish loader %s for %s\n", record.Version, strings.Join(result.published, " and "))
	default:
		fmt.Printf("Published loader %s for %s\n", record.Version, strings.Join(result.published, " and "))
	}
	return nil
}

// stageLoaderBuild checks both assets carry version and describes them under loader/<version>/.
func stageLoaderBuild(version, commit, deb, module, cdnURL string) (loaderBuildRecord, error) {
	if _, err := parseSemanticVersion(version); err != nil {
		return loaderBuildRecord{}, fmt.Errorf("invalid loader version %q: %w", version, err)
	}
	// Theos names the package <id>_<version>_<arch>.deb from the control file the build stamped.
	if !strings.HasSuffix(deb, ".deb") || !strings.Contains(filepath.Base(deb), "_"+version+"_") {
		return loaderBuildRecord{}, fmt.Errorf("%s is not the loader %s deb", deb, version)
	}
	manifest, err := readAPKManifest(module)
	if err != nil {
		return loaderBuildRecord{}, fmt.Errorf("Failed to read the manifest of %s: %w", module, err)
	}
	if manifest.Package != androidModulePackage || manifest.VersionName != version {
		return loaderBuildRecord{}, fmt.Errorf("%s is %s %s, not the loader %s module", module, manifest.Package, manifest.VersionName, version)
	}
	record := loaderBuildRecord{Version: version, Commit: commit}
	for _, asset := range []loaderBuildAsset{
		{Platform: "ios", path: deb, contentType: debContentType},
		{Platform: "android", path: module, contentType: androidAPKContentType},
	} {
		asset.Name = filepath.Base(asset.path)
		asset.Key = loaderBuildPrefix(version) + "/" + asset.Name
		asset.URL = cdnURL + "/" + asset.Key
		sum, size, err := hashFile(asset.path)
		if err != nil {
			return loaderBuildRecord{}, fmt.Errorf("Failed to hash %s: %w", asset.path, err)
		}
		asset.SHA256, asset.Size = sum, size
		record.Assets = append(record.Assets, asset)
	}
	return record, nil
}

func loaderBuildPrefix(version string) string {
	return loaderBuildBucketRoot + "/" + version
}

func hashFile(path string) (string, int64, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", 0, err
	}
	defer file.Close()
	hash := sha256.New()
	size, err := io.Copy(hash, file)
	if err != nil {
		return "", 0, err
	}
	return hex.EncodeToString(hash.Sum(nil)), size, nil
}

// uploadLoaderBuild uploads both assets, then build.json. A version already published is left alone.
func uploadLoaderBuild(ctx context.Context, bucket s3Bucket, record loaderBuildRecord, encoded []byte) error {
	recordKey := loaderBuildPrefix(record.Version) + "/" + loaderBuildRecordName
	published, err := bucket.exists(ctx, recordKey)
	if err != nil {
		return err
	}
	if published {
		fmt.Println(recordKey, "is already published; builds are never overwritten")
		return nil
	}
	for _, asset := range record.Assets {
		if err := bucket.putFile(ctx, asset.Key, asset.path, asset.contentType); err != nil {
			return fmt.Errorf("Failed to upload the %s loader %s: %w", asset.Platform, asset.Name, err)
		}
		fmt.Println("uploaded", asset.Key)
	}
	recordPath := filepath.Join(os.TempDir(), "loader-"+record.Version+"-"+loaderBuildRecordName)
	if err := os.WriteFile(recordPath, encoded, 0o644); err != nil {
		return err
	}
	defer os.Remove(recordPath)
	if err := bucket.putFile(ctx, recordKey, recordPath, "application/json"); err != nil {
		return fmt.Errorf("Failed to upload %s: %w", recordKey, err)
	}
	fmt.Println("uploaded", recordKey)
	return nil
}
