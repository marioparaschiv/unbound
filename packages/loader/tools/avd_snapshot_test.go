package main

import (
	"archive/tar"
	"compress/gzip"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeGzipTar(t *testing.T, file string, entries map[string]string) {
	t.Helper()
	handle, err := os.Create(file)
	if err != nil {
		t.Fatal(err)
	}
	compressed := gzip.NewWriter(handle)
	writer := tar.NewWriter(compressed)
	for name, content := range entries {
		if err := writer.WriteHeader(&tar.Header{Name: name, Mode: 0o600, Size: int64(len(content)), Typeflag: tar.TypeReg}); err != nil {
			t.Fatal(err)
		}
		if _, err := writer.Write([]byte(content)); err != nil {
			t.Fatal(err)
		}
	}
	for _, closer := range []func() error{writer.Close, compressed.Close, handle.Close} {
		if err := closer(); err != nil {
			t.Fatal(err)
		}
	}
}

func TestEnsureNoDiscordTokenRefusesTokenShapedContent(t *testing.T) {
	directory := t.TempDir()
	clean := filepath.Join(directory, "clean.tgz")
	leaked := filepath.Join(directory, "leaked.tgz")
	writeGzipTar(t, clean, map[string]string{"astral/Plugins/a/bundle.js": "console.log('plugin')"})
	writeGzipTar(t, leaked, map[string]string{"adb/magisk.db": "token=" + strings.Repeat("M", 26) + "." + strings.Repeat("G", 6) + "." + strings.Repeat("x", 38)})
	if err := ensureNoDiscordToken(clean); err != nil {
		t.Fatalf("clean archive was refused: %v", err)
	}
	err := ensureNoDiscordToken(clean, leaked)
	if err == nil || !strings.Contains(err.Error(), "adb/magisk.db") {
		t.Fatalf("expected the token-bearing entry to be named, got %v", err)
	}
}

func TestContainsDiscordTokenMatchesMFATokens(t *testing.T) {
	if !containsDiscordToken([]byte("mfa." + strings.Repeat("a", 84))) {
		t.Fatal("mfa token was not detected")
	}
	if containsDiscordToken([]byte("astral.bundle.trust sha256 0123456789abcdef")) {
		t.Fatal("ordinary content was flagged")
	}
}

func TestAstralArchiveCommandLeavesSettingsOutByDefault(t *testing.T) {
	if strings.Contains(astralArchiveCommand(false), "settings.json") {
		t.Fatal("settings.json must be opt-in")
	}
	if !strings.Contains(astralArchiveCommand(true), "astral/settings.json") {
		t.Fatal("--with-settings should include settings.json")
	}
	for _, store := range []string{"mmkv", "kv-storage", "shared_prefs", "databases"} {
		if strings.Contains(astralArchiveCommand(true), store) {
			t.Fatalf("snapshot must never read Discord's %s", store)
		}
	}
}

func TestAdbArchiveCommandSkipsLogsAndSockets(t *testing.T) {
	command := adbArchiveCommand()
	for _, entry := range avdSnapshotAdbExcludes {
		if !strings.Contains(command, "--exclude="+entry) {
			t.Fatalf("expected %s to be excluded: %s", entry, command)
		}
	}
}

func TestPackagePathsParsesSplits(t *testing.T) {
	got := packagePaths("package:/data/app/x/split_config.en.apk\npackage:/data/app/x/base.apk\n\n")
	if len(got) != 2 || got[0] != "/data/app/x/base.apk" {
		t.Fatalf("unexpected package paths %#v", got)
	}
}

func TestSnapshotTarRoundTripRejectsEscapingEntries(t *testing.T) {
	source := t.TempDir()
	if err := os.MkdirAll(filepath.Join(source, "apks", "com.discord"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(source, "apks", "com.discord", "base.apk"), []byte("apk"), 0o644); err != nil {
		t.Fatal(err)
	}
	archive := filepath.Join(t.TempDir(), "snapshot.tar")
	if err := writeTarDirectory(source, archive); err != nil {
		t.Fatal(err)
	}
	target := t.TempDir()
	if err := extractTarFile(archive, target); err != nil {
		t.Fatal(err)
	}
	if data, err := os.ReadFile(filepath.Join(target, "apks", "com.discord", "base.apk")); err != nil || string(data) != "apk" {
		t.Fatalf("round trip lost the apk: %v", err)
	}

	hostile := filepath.Join(t.TempDir(), "hostile.tar")
	handle, err := os.Create(hostile)
	if err != nil {
		t.Fatal(err)
	}
	writer := tar.NewWriter(handle)
	if err := writer.WriteHeader(&tar.Header{Name: "../escape", Mode: 0o644, Size: 1, Typeflag: tar.TypeReg}); err != nil {
		t.Fatal(err)
	}
	if _, err := writer.Write([]byte("x")); err != nil {
		t.Fatal(err)
	}
	writer.Close()
	handle.Close()
	if err := extractTarFile(hostile, t.TempDir()); err == nil {
		t.Fatal("escaping entry was extracted")
	}
}

func TestPublishableSnapshotsLeaveDiscordOut(t *testing.T) {
	names := snapshotPackageNames(true)
	for _, name := range names {
		if name == discordPackage {
			t.Fatal("a snapshot without Discord must not pull its APKs")
		}
	}
	if len(names) != len(avdSnapshotPackages)-1 || len(snapshotPackageNames(false)) != len(avdSnapshotPackages) {
		t.Fatalf("unexpected package lists %v", names)
	}
	without := avdSnapshotManifest{Packages: map[string][]string{"app.astral.android": {"base.apk"}}}
	if !strings.Contains(describeSnapshotDiscord(without), "restore downloads") {
		t.Fatalf("unexpected description %q", describeSnapshotDiscord(without))
	}
	with := avdSnapshotManifest{DiscordVersion: "352.10", Packages: map[string][]string{discordPackage: {"base.apk"}}}
	if describeSnapshotDiscord(with) != "Discord 352.10" {
		t.Fatalf("unexpected description %q", describeSnapshotDiscord(with))
	}
}

func TestLocalSnapshotFileKeepsLocalPaths(t *testing.T) {
	if got, err := localSnapshotFile("/tmp/snapshot.tar", t.TempDir()); err != nil || got != "/tmp/snapshot.tar" {
		t.Fatalf("local paths must be used as they are, got %q %v", got, err)
	}
}
