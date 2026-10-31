package main

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const (
	avdSnapshotVerifySuffix = "_snapshot_verify"
	avdSnapshotVerifyLimit  = 5 * time.Minute
	avdSnapshotAsset        = "unbound-avd.tar"
)

var loadedPluginsLine = regexp.MustCompile(`Loaded (\d+) plugins?\.`)

type avdSnapshotComponents struct {
	magisk string
	vector string
}

func publishAVDSnapshot(profile avdProfile, repository, tag string, dryRun bool) error {
	serial, err := runningAVDSerial(profile.Name)
	if err != nil {
		return err
	}
	components := readSnapshotComponents(serial)
	staging, err := os.MkdirTemp("", "unbound-avd-publish-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(staging)
	archive := filepath.Join(staging, avdSnapshotAsset)
	if err := saveAVDSnapshot(profile, archive, false, true); err != nil {
		return err
	}
	checksum, err := fileSHA256(archive)
	if err != nil {
		return err
	}
	if err := verifyAVDSnapshot(profile, serial, archive, checksum); err != nil {
		return fmt.Errorf("the snapshot did not restore cleanly, so it was not published: %w", err)
	}
	if dryRun {
		fmt.Print(snapshotReleaseNotes(profile, repository, tag, checksum, components))
		return nil
	}
	notes := filepath.Join(staging, "notes.md")
	if err := os.WriteFile(notes, []byte(snapshotReleaseNotes(profile, repository, tag, checksum, components)), 0o644); err != nil {
		return err
	}
	title := "Provisioned AVD snapshot (" + strings.TrimPrefix(tag, "avd-snapshot-") + ")"
	if err := devRunCommand("gh", "release", "create", tag, archive, "--repo", repository, "--target", "main", "--prerelease", "--latest=false", "--title", title, "--notes-file", notes); err != nil {
		return fmt.Errorf("publish the release: %w", err)
	}
	fmt.Printf("Published %s with SHA-256 %s\n", tag, checksum)
	return nil
}

func verifyAVDSnapshot(profile avdProfile, serial, archive, checksum string) error {
	if err := devRunCommand("adb", "-s", serial, "emu", "kill"); err != nil {
		return fmt.Errorf("stop %s: %w", profile.Name, err)
	}
	defer func() {
		if err := startAVD(profile); err != nil {
			fmt.Fprintf(os.Stderr, "Restarting %s failed: %v\n", profile.Name, err)
		}
	}()
	if err := waitForAVDStopped(profile.Name, time.Minute); err != nil {
		return err
	}
	verify := profile
	verify.Name = profile.Name + avdSnapshotVerifySuffix
	defer removeAVD(verify)
	if err := restoreAVDSnapshot(verify, archive, avdSnapshotRestoreOptions{sha256: checksum, discordChannel: "stable"}); err != nil {
		return err
	}
	verifySerial, err := runningAVDSerial(verify.Name)
	if err != nil {
		return err
	}
	defer func() {
		_ = devRunCommand("adb", "-s", verifySerial, "emu", "kill")
		_ = waitForAVDStopped(verify.Name, time.Minute)
	}()
	return checkRestoredAVD(verifySerial)
}

func checkRestoredAVD(serial string) error {
	identity, err := devCommandOutput("adb", "-s", serial, "shell", "su -c id")
	if err != nil || !strings.Contains(identity, "uid=0(root)") {
		return fmt.Errorf("su does not give root on the restored AVD: %s", strings.TrimSpace(identity))
	}
	modules, _ := devCommandOutput("adb", "-s", serial, "shell", "su -c 'ls /data/adb/modules'")
	if xposedFramework(modules) == "" {
		return errors.New("the restored AVD has no Xposed framework module")
	}
	_, _ = devCommandOutput("adb", "-s", serial, "logcat", "-c")
	if _, err := devCommandOutput("adb", "-s", serial, "shell", "monkey -p "+discordPackage+" -c android.intent.category.LAUNCHER 1"); err != nil {
		return err
	}
	deadline := time.Now().Add(avdSnapshotVerifyLimit)
	for time.Now().Before(deadline) {
		logs, _ := devCommandOutput("adb", "-s", serial, "logcat", "-d", "-s", "Unbound")
		if count, executed := restoredAVDProgress(logs); count > 0 && executed {
			fmt.Printf("Restored AVD loaded %d plugins and executed Unbound's bundle\n", count)
			return nil
		}
		time.Sleep(3 * time.Second)
	}
	return fmt.Errorf("Discord did not load Unbound's plugins and bundle within %s on the restored AVD", avdSnapshotVerifyLimit)
}

func restoredAVDProgress(logs string) (int, bool) {
	count := 0
	if match := loadedPluginsLine.FindStringSubmatch(logs); match != nil {
		count, _ = strconv.Atoi(match[1])
	}
	return count, strings.Contains(logs, smokeBundleExecuted)
}

func waitForAVDStopped(name string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if _, err := runningAVDSerial(name); err != nil {
			return nil
		}
		time.Sleep(2 * time.Second)
	}
	return fmt.Errorf("%s did not stop within %s", name, timeout)
}

func removeAVD(profile avdProfile) {
	config, err := avdConfigPath(profile.Name)
	if err != nil {
		return
	}
	directory := filepath.Dir(config)
	os.RemoveAll(directory)
	os.Remove(filepath.Join(filepath.Dir(directory), profile.Name+".ini"))
}

func readSnapshotComponents(serial string) avdSnapshotComponents {
	magisk, _ := devCommandOutput("adb", "-s", serial, "shell", "dumpsys", "package", "com.topjohnwu.magisk")
	vector, _ := devCommandOutput("adb", "-s", serial, "shell", "su -c 'cat /data/adb/modules/*/module.prop'")
	return avdSnapshotComponents{magisk: packageVersionName(magisk), vector: modulePropValue(vector, "version")}
}

func modulePropValue(prop, key string) string {
	for _, line := range strings.Split(prop, "\n") {
		if value, found := strings.CutPrefix(strings.TrimSpace(line), key+"="); found {
			return value
		}
	}
	return ""
}

func fileSHA256(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	digest := sha256.New()
	if _, err := io.Copy(digest, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(digest.Sum(nil)), nil
}

func snapshotReleaseNotes(profile avdProfile, repository, tag, checksum string, components avdSnapshotComponents) string {
	url := "https://github.com/" + repository + "/releases/download/" + tag + "/" + avdSnapshotAsset
	var notes strings.Builder
	fmt.Fprintf(&notes, "A rooted, Xposed-ready snapshot of the `%s` dev AVD (`%s`, %s profile), so a new AVD can skip the manual rooting steps.\n\n", profile.Name, profile.SystemImage, profile.Device)
	fmt.Fprintf(&notes, "```bash\ngo run ./tools dev android-avd snapshot restore --from %s --sha256 %s\n```\n\n", url, checksum)
	notes.WriteString("Run it from `packages/loader` with the AVD stopped. Restore downloads Discord's newest stable build; pick another channel with `--discord-channel beta|alpha`.\n\n")
	fmt.Fprintf(&notes, "**SHA-256:** `%s`\n\n", checksum)
	notes.WriteString("Before publishing, this snapshot was restored onto a fresh AVD, which gave root, loaded the Xposed module and every plugin, and executed Unbound's bundle. It holds no Discord APK and no Discord account data.\n\n")
	notes.WriteString("## Third-party components\n")
	fmt.Fprintf(&notes, "- [Magisk](https://github.com/topjohnwu/Magisk) %s, GPL-3.0. Source: https://github.com/topjohnwu/Magisk/tree/v%s\n", valueOr(components.magisk, "unknown"), components.magisk)
	fmt.Fprintf(&notes, "- [Vector](https://github.com/JingMatrix/Vector) %s, GPL-3.0. Source: https://github.com/JingMatrix/Vector\n", valueOr(components.vector, "unknown"))
	return notes.String()
}
