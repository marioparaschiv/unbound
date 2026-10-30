package main

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

const (
	avdSnapshotManifestName = "manifest.json"
	avdSnapshotRamdiskName  = "ramdisk.img"
	avdSnapshotAdbName      = "adb.tgz"
	avdSnapshotAstralName   = "astral.tgz"
	avdSnapshotDeviceDir    = "/data/local/tmp/astral-avd-snapshot"
	discordPackage          = "com.discord"
	discordFilesDir         = "/data/data/com.discord/files"
)

var avdSnapshotPackages = []string{"com.topjohnwu.magisk", "app.astral.android", discordPackage}

var avdSnapshotAdbExcludes = []string{"adb/lspd/log", "adb/lspd/log.old", "adb/lspd/.cli_sock", "adb/lspd/lock"}

var avdSnapshotAstralEntries = []string{"astral/Plugins", "astral/Themes", "astral/Fonts", "astral/i18n", "astral/astral.bundle", "astral/astral.bundle.trust"}

var discordTokenPatterns = []*regexp.Regexp{
	regexp.MustCompile(`[A-Za-z0-9_-]{24,28}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,38}`),
	regexp.MustCompile(`mfa\.[A-Za-z0-9_-]{84}`),
}

type avdSnapshotManifest struct {
	Profile        string              `json:"profile"`
	SystemImage    string              `json:"systemImage"`
	DiscordVersion string              `json:"discordVersion"`
	CreatedAt      string              `json:"createdAt"`
	Packages       map[string][]string `json:"packages"`
	Settings       bool                `json:"settings"`
}

type avdSnapshotRestoreOptions struct {
	sha256         string
	discordChannel string
}

func runAVDSnapshot(args []string) error {
	if len(args) == 0 {
		return errors.New("usage: dev android-avd snapshot <save|restore|publish> (--out <file> [--with-settings] [--without-discord] | --from <file|https-url> [--sha256 <hex>] [--discord-channel <channel>] | [--repo <owner/name>] [--tag <tag>]) [--name <name>] [--root <path>]")
	}
	set := flag.NewFlagSet("dev android-avd snapshot", flag.ContinueOnError)
	root := set.String("root", ".", "repository root")
	name := set.String("name", "", "Android virtual device name")
	out := set.String("out", "", "snapshot file to write")
	from := set.String("from", "", "snapshot file to restore")
	withSettings := set.Bool("with-settings", false, "include astral settings.json")
	withoutDiscord := set.Bool("without-discord", false, "leave Discord's APKs out, so the snapshot can be published; restore downloads Discord")
	checksum := set.String("sha256", "", "SHA-256 the snapshot must match when restoring")
	discordChannel := set.String("discord-channel", "stable", "Discord channel restore downloads when the snapshot has no Discord")
	repository := set.String("repo", "marioparaschiv/unbound", "repository publish releases the snapshot to")
	tag := set.String("tag", "", "release tag publish creates; avd-snapshot-<date> when empty")
	dryRun := set.Bool("dry-run", false, "publish: save and verify the snapshot, then print the release notes instead of publishing")
	if err := set.Parse(args[1:]); err != nil {
		return err
	}
	rootPath, err := filepath.Abs(*root)
	if err != nil {
		return err
	}
	profile, err := readAVDProfile(rootPath)
	if err != nil {
		return err
	}
	if *name != "" {
		profile.Name = *name
	}
	switch args[0] {
	case "save":
		if *out == "" {
			return errors.New("snapshot save needs --out <file>")
		}
		return saveAVDSnapshot(profile, *out, *withSettings, *withoutDiscord)
	case "restore":
		if *from == "" {
			return errors.New("snapshot restore needs --from <file>")
		}
		if discordAndroidChannelRank(*discordChannel) < 0 {
			return fmt.Errorf("--discord-channel takes stable, beta or alpha, not %q", *discordChannel)
		}
		return restoreAVDSnapshot(profile, *from, avdSnapshotRestoreOptions{sha256: *checksum, discordChannel: *discordChannel})
	case "publish":
		return publishAVDSnapshot(profile, *repository, valueOr(*tag, "avd-snapshot-"+time.Now().UTC().Format("20060102")), *dryRun)
	default:
		return fmt.Errorf("unknown snapshot action %q", args[0])
	}
}

func saveAVDSnapshot(profile avdProfile, out string, withSettings, withoutDiscord bool) error {
	serial, err := runningAVDSerial(profile.Name)
	if err != nil {
		return err
	}
	if err := rootAndroidDevice(serial); err != nil {
		return err
	}
	staging, err := os.MkdirTemp("", "astral-avd-snapshot-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(staging)

	if err := copyPatchedRamdisk(profile, filepath.Join(staging, avdSnapshotRamdiskName)); err != nil {
		return err
	}
	packages, err := pullSnapshotPackages(serial, staging, snapshotPackageNames(withoutDiscord))
	if err != nil {
		return err
	}
	if err := pullDeviceArchive(serial, filepath.Join(staging, avdSnapshotAdbName), adbArchiveCommand()); err != nil {
		return err
	}
	if err := pullDeviceArchive(serial, filepath.Join(staging, avdSnapshotAstralName), astralArchiveCommand(withSettings)); err != nil {
		return err
	}
	if err := ensureNoDiscordToken(filepath.Join(staging, avdSnapshotAdbName), filepath.Join(staging, avdSnapshotAstralName)); err != nil {
		return err
	}
	discordVersion := ""
	if !withoutDiscord {
		dumpsys, _ := devCommandOutput("adb", "-s", serial, "shell", "dumpsys", "package", discordPackage)
		discordVersion = packageVersionName(dumpsys)
	}
	manifest := avdSnapshotManifest{
		Profile:        profile.Name,
		SystemImage:    profile.SystemImage,
		DiscordVersion: discordVersion,
		CreatedAt:      time.Now().UTC().Format(time.RFC3339),
		Packages:       packages,
		Settings:       withSettings,
	}
	data, err := json.MarshalIndent(manifest, "", "\t")
	if err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(staging, avdSnapshotManifestName), data, 0o644); err != nil {
		return err
	}
	if err := writeTarDirectory(staging, out); err != nil {
		return err
	}
	fmt.Printf("Saved AVD snapshot to %s (%s, no account data)\n", out, describeSnapshotDiscord(manifest))
	return nil
}

func restoreAVDSnapshot(profile avdProfile, from string, options avdSnapshotRestoreOptions) error {
	staging, err := os.MkdirTemp("", "astral-avd-restore-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(staging)
	archive, err := localSnapshotFile(from, staging)
	if err != nil {
		return err
	}
	if options.sha256 != "" && !matchesSHA256(archive, options.sha256) {
		return errors.New("the snapshot does not match --sha256")
	}
	if err := extractTarFile(archive, staging); err != nil {
		return err
	}
	if archive != from {
		os.Remove(archive)
	}
	manifest, err := readAVDSnapshotManifest(staging)
	if err != nil {
		return err
	}
	if manifest.SystemImage != profile.SystemImage {
		return fmt.Errorf("snapshot was taken on %s but the AVD profile uses %s", manifest.SystemImage, profile.SystemImage)
	}
	if _, err := runningAVDSerial(profile.Name); err == nil {
		return errors.New("stop the Android AVD before restoring a snapshot")
	}
	if err := installPatchedRamdisk(profile, filepath.Join(staging, avdSnapshotRamdiskName)); err != nil {
		return err
	}
	if err := setupAVD(profile); err != nil {
		return err
	}
	if err := startAVD(profile); err != nil {
		return err
	}
	serial, err := runningAVDSerial(profile.Name)
	if err != nil {
		return err
	}
	if err := installSnapshotPackages(serial, staging, manifest.Packages); err != nil {
		return err
	}
	if len(manifest.Packages[discordPackage]) == 0 {
		if err := installLatestDiscord(serial, options.discordChannel, staging); err != nil {
			return fmt.Errorf("install Discord %s: %w", options.discordChannel, err)
		}
	}
	if err := pushDeviceArchive(serial, filepath.Join(staging, avdSnapshotAdbName), "tar -xzf "+avdSnapshotDeviceDir+"/archive.tgz -C /data && restorecon -R /data/adb"); err != nil {
		return err
	}
	if err := devRunCommand("adb", "-s", serial, "reboot"); err != nil {
		return err
	}
	if serial, err = waitForAVD(profile.Name, 3*time.Minute); err != nil {
		return err
	}
	if err := rootAndroidDevice(serial); err != nil {
		return err
	}
	if err := pushDeviceArchive(serial, filepath.Join(staging, avdSnapshotAstralName), restoreAstralCommand()); err != nil {
		return err
	}
	fmt.Printf("Restored AVD snapshot from %s onto %s; sign in to Discord to continue\n", from, profile.Name)
	return nil
}

func runningAVDSerial(name string) (string, error) {
	devices, err := listAndroidDevices()
	if err != nil {
		return "", err
	}
	for _, device := range devices {
		if device.AVD == name && device.State == "device" {
			return device.Serial, nil
		}
	}
	return "", fmt.Errorf("Android AVD %s is not running; start it with `go run ./tools dev android-avd start`", name)
}

func copyPatchedRamdisk(profile avdProfile, destination string) error {
	image, err := androidSystemImagePath(profile)
	if err != nil {
		return err
	}
	if _, err := os.Stat(filepath.Join(image, "ramdisk.img.backup")); err != nil {
		return errors.New("the AVD ramdisk is not patched with Magisk; root the AVD before saving a snapshot")
	}
	return copyFile(filepath.Join(image, "ramdisk.img"), destination)
}

func installPatchedRamdisk(profile avdProfile, source string) error {
	image, err := androidSystemImagePath(profile)
	if err != nil {
		return err
	}
	if _, err := os.Stat(image); errors.Is(err, os.ErrNotExist) {
		if err := devRunCommand("sdkmanager", "--install", profile.SystemImage); err != nil {
			return fmt.Errorf("install Android system image: %w", err)
		}
	}
	backup := filepath.Join(image, "ramdisk.img.backup")
	if _, err := os.Stat(backup); errors.Is(err, os.ErrNotExist) {
		if err := copyFile(filepath.Join(image, "ramdisk.img"), backup); err != nil {
			return err
		}
	}
	return copyFile(source, filepath.Join(image, "ramdisk.img"))
}

func snapshotPackageNames(withoutDiscord bool) []string {
	if !withoutDiscord {
		return avdSnapshotPackages
	}
	names := []string{}
	for _, name := range avdSnapshotPackages {
		if name != discordPackage {
			names = append(names, name)
		}
	}
	return names
}

func describeSnapshotDiscord(manifest avdSnapshotManifest) string {
	if len(manifest.Packages[discordPackage]) == 0 {
		return "without Discord, which restore downloads"
	}
	return "Discord " + valueOr(manifest.DiscordVersion, "unknown")
}

func pullSnapshotPackages(serial, staging string, names []string) (map[string][]string, error) {
	packages := map[string][]string{}
	for _, name := range names {
		output, err := devCommandOutput("adb", "-s", serial, "shell", "pm", "path", name)
		if err != nil {
			return nil, fmt.Errorf("%s is not installed on the AVD: %w", name, err)
		}
		directory := filepath.Join(staging, "apks", name)
		if err := os.MkdirAll(directory, 0o755); err != nil {
			return nil, err
		}
		for _, remote := range packagePaths(output) {
			file := path.Base(remote)
			if _, err := devCommandOutput("adb", "-s", serial, "pull", remote, filepath.Join(directory, file)); err != nil {
				return nil, err
			}
			packages[name] = append(packages[name], file)
		}
	}
	return packages, nil
}

func packagePaths(output string) []string {
	paths := []string{}
	for _, line := range strings.Split(output, "\n") {
		if remote, found := strings.CutPrefix(strings.TrimSpace(line), "package:"); found && remote != "" {
			paths = append(paths, remote)
		}
	}
	sort.Strings(paths)
	return paths
}

func installSnapshotPackages(serial, staging string, packages map[string][]string) error {
	for _, name := range avdSnapshotPackages {
		files := packages[name]
		if len(files) == 0 && name == discordPackage {
			continue
		}
		if len(files) == 0 {
			return fmt.Errorf("snapshot is missing %s", name)
		}
		args := []string{"-s", serial, "install-multiple", "-r"}
		for _, file := range files {
			args = append(args, filepath.Join(staging, "apks", name, file))
		}
		if err := devRunCommand("adb", args...); err != nil {
			return fmt.Errorf("install %s: %w", name, err)
		}
	}
	return nil
}

func adbArchiveCommand() string {
	excludes := []string{}
	for _, entry := range avdSnapshotAdbExcludes {
		excludes = append(excludes, "--exclude="+entry)
	}
	return "tar -czf - " + strings.Join(excludes, " ") + " -C /data adb 2>/dev/null"
}

func astralArchiveCommand(withSettings bool) string {
	entries := append([]string{}, avdSnapshotAstralEntries...)
	if withSettings {
		entries = append(entries, "astral/settings.json")
	}
	present := []string{}
	for _, entry := range entries {
		present = append(present, "$([ -e "+entry+" ] && echo "+entry+")")
	}
	return "cd " + discordFilesDir + " && tar -czf - " + strings.Join(present, " ") + " 2>/dev/null"
}

func restoreAstralCommand() string {
	archive := avdSnapshotDeviceDir + "/archive.tgz"
	owner := "$(stat -c %u:%g /data/data/" + discordPackage + ")"
	return "mkdir -p -m 700 " + discordFilesDir + " && tar -xzf " + archive + " -C " + discordFilesDir +
		" && chmod 700 " + discordFilesDir + " " + discordFilesDir + "/astral" +
		" && chown -R " + owner + " " + discordFilesDir + " && restorecon -R " + discordFilesDir
}

func pullDeviceArchive(serial, destination, command string) error {
	file, err := os.Create(destination)
	if err != nil {
		return err
	}
	defer file.Close()
	pull := exec.Command("adb", "-s", serial, "exec-out", command)
	pull.Stdout = file
	var stderr strings.Builder
	pull.Stderr = &stderr
	if err := pull.Run(); err != nil {
		return fmt.Errorf("archive on AVD: %w: %s", err, strings.TrimSpace(stderr.String()))
	}
	return verifyGzipArchive(destination)
}

func pushDeviceArchive(serial, source, extract string) error {
	if _, err := devCommandOutput("adb", "-s", serial, "shell", "mkdir -p "+avdSnapshotDeviceDir); err != nil {
		return err
	}
	if _, err := devCommandOutput("adb", "-s", serial, "push", source, avdSnapshotDeviceDir+"/archive.tgz"); err != nil {
		return err
	}
	_, err := devCommandOutput("adb", "-s", serial, "shell", extract+"; status=$?; rm -rf "+avdSnapshotDeviceDir+"; exit $status")
	return err
}

func verifyGzipArchive(file string) error {
	return walkGzipTar(file, func(string, []byte) error { return nil })
}

func ensureNoDiscordToken(archives ...string) error {
	for _, archive := range archives {
		err := walkGzipTar(archive, func(name string, content []byte) error {
			if containsDiscordToken(content) {
				return fmt.Errorf("refusing to save the snapshot: %s in %s looks like it holds a Discord token", name, filepath.Base(archive))
			}
			return nil
		})
		if err != nil {
			return err
		}
	}
	return nil
}

func containsDiscordToken(content []byte) bool {
	for _, pattern := range discordTokenPatterns {
		if pattern.Match(content) {
			return true
		}
	}
	return false
}

func walkGzipTar(file string, visit func(string, []byte) error) error {
	handle, err := os.Open(file)
	if err != nil {
		return err
	}
	defer handle.Close()
	decompressed, err := gzip.NewReader(handle)
	if err != nil {
		return fmt.Errorf("%s is not a gzip archive: %w", filepath.Base(file), err)
	}
	defer decompressed.Close()
	reader := tar.NewReader(decompressed)
	for {
		header, err := reader.Next()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("read %s: %w", filepath.Base(file), err)
		}
		if header.Typeflag != tar.TypeReg {
			continue
		}
		content, err := io.ReadAll(reader)
		if err != nil {
			return err
		}
		if err := visit(header.Name, content); err != nil {
			return err
		}
	}
}

func readAVDSnapshotManifest(directory string) (avdSnapshotManifest, error) {
	data, err := os.ReadFile(filepath.Join(directory, avdSnapshotManifestName))
	if err != nil {
		return avdSnapshotManifest{}, fmt.Errorf("snapshot has no manifest: %w", err)
	}
	var manifest avdSnapshotManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return avdSnapshotManifest{}, fmt.Errorf("decode snapshot manifest: %w", err)
	}
	if manifest.SystemImage == "" || len(manifest.Packages) == 0 {
		return avdSnapshotManifest{}, errors.New("snapshot manifest is incomplete")
	}
	return manifest, nil
}

func writeTarDirectory(directory, out string) error {
	if err := os.MkdirAll(filepath.Dir(out), 0o755); err != nil {
		return err
	}
	file, err := os.Create(out)
	if err != nil {
		return err
	}
	writer := tar.NewWriter(file)
	walkErr := filepath.Walk(directory, func(current string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return err
		}
		relative, err := filepath.Rel(directory, current)
		if err != nil {
			return err
		}
		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		header.Name = filepath.ToSlash(relative)
		if err := writer.WriteHeader(header); err != nil {
			return err
		}
		source, err := os.Open(current)
		if err != nil {
			return err
		}
		defer source.Close()
		_, err = io.Copy(writer, source)
		return err
	})
	closeErr := errors.Join(writer.Close(), file.Close())
	if walkErr != nil || closeErr != nil {
		os.Remove(out)
	}
	return errors.Join(walkErr, closeErr)
}

func extractTarFile(source, directory string) error {
	file, err := os.Open(source)
	if err != nil {
		return err
	}
	defer file.Close()
	reader := tar.NewReader(file)
	for {
		header, err := reader.Next()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("read snapshot: %w", err)
		}
		if header.Typeflag != tar.TypeReg {
			continue
		}
		target := filepath.Join(directory, filepath.FromSlash(header.Name))
		if !strings.HasPrefix(target, filepath.Clean(directory)+string(os.PathSeparator)) {
			return fmt.Errorf("snapshot entry %q escapes the extraction directory", header.Name)
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		output, err := os.Create(target)
		if err != nil {
			return err
		}
		_, copyErr := io.Copy(output, reader)
		if err := errors.Join(copyErr, output.Close()); err != nil {
			return err
		}
	}
}

func localSnapshotFile(from, staging string) (string, error) {
	if !strings.HasPrefix(from, "https://") {
		return from, nil
	}
	destination := filepath.Join(staging, "download.tar")
	fmt.Fprintf(os.Stderr, "Downloading %s\n", from)
	if err := downloadDirect(from, "", destination); err != nil {
		return "", err
	}
	return destination, nil
}

func installLatestDiscord(serial, channel, staging string) error {
	ctx := context.Background()
	adb := adbForSerial(serial)
	splits, err := discordDeviceSplits(ctx, adb)
	if err != nil {
		return err
	}
	sources := discordAPKSources{
		sniffURL:   strings.TrimRight(envOr("DISCORD_SNIFF_URL", defaultSniffURL), "/"),
		trackerURL: strings.TrimRight(envOr("DISCORD_TRACKER", defaultAndroidTracker), "/"),
		client:     &http.Client{Timeout: discordAPKLookupLimit},
	}
	code, err := sources.latestCode(ctx, channel)
	if err != nil {
		return err
	}
	directory := filepath.Join(staging, "discord")
	if err := os.MkdirAll(directory, 0o755); err != nil {
		return err
	}
	files := map[string]string{}
	downloads := &http.Client{Timeout: discordAPKDownloadLimit}
	for split, endpoint := range sources.splitURLs(ctx, channel, code, orderSplits(append([]string{"base"}, splits...))) {
		path := filepath.Join(directory, split+".apk")
		if _, err := downloadDiscordSplit(ctx, downloads, endpoint, path, code); err != nil {
			return err
		}
		files[split] = path
	}
	return installDiscordSplits(ctx, adb, files)
}
