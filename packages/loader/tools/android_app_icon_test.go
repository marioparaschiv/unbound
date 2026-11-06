package main

import (
	"archive/zip"
	"bytes"
	"io"
	"os"
	"path/filepath"
	"testing"
)

func TestPatchDiscordAppIconReplacesLauncherSlotsAndPreservesOtherEntries(t *testing.T) {
	directory := t.TempDir()
	apkPath := filepath.Join(directory, "base.apk")
	iconPath := filepath.Join(directory, "unbound.webp")
	icon := []byte("unbound-icon")
	if err := os.WriteFile(iconPath, icon, 0o600); err != nil {
		t.Fatal(err)
	}
	writeAndroidAppIconFixture(t, apkPath, true)

	if err := patchDiscordAppIcon(apkPath, iconPath); err != nil {
		t.Fatal(err)
	}
	if err := patchDiscordAppIcon(apkPath, iconPath); err != nil {
		t.Fatal(err)
	}

	archive, err := zip.OpenReader(apkPath)
	if err != nil {
		t.Fatal(err)
	}
	defer archive.Close()
	entries := make(map[string][]byte, len(archive.File))
	for _, entry := range archive.File {
		reader, err := entry.Open()
		if err != nil {
			t.Fatal(err)
		}
		content, err := io.ReadAll(reader)
		reader.Close()
		if err != nil {
			t.Fatal(err)
		}
		entries[entry.Name] = content
	}
	for name := range discordIconEntries() {
		if !bytes.Equal(entries[name], icon) {
			t.Errorf("%s was not replaced", name)
		}
	}
	if !bytes.Equal(entries[androidAppIconMarker], []byte(`{"id":"BrandInvertedIcon"}`)) {
		t.Errorf("unexpected marker %q", entries[androidAppIconMarker])
	}
	if !bytes.Equal(entries["assets/untouched.bin"], []byte("unchanged")) {
		t.Errorf("unrelated APK entry changed to %q", entries["assets/untouched.bin"])
	}
}

func TestPatchDiscordAppIconLeavesAPKUnchangedWhenRequiredResourceIsMissing(t *testing.T) {
	directory := t.TempDir()
	apkPath := filepath.Join(directory, "base.apk")
	iconPath := filepath.Join(directory, "unbound.webp")
	if err := os.WriteFile(iconPath, []byte("unbound-icon"), 0o600); err != nil {
		t.Fatal(err)
	}
	writeAndroidAppIconFixture(t, apkPath, false)
	before, err := os.ReadFile(apkPath)
	if err != nil {
		t.Fatal(err)
	}

	if err := patchDiscordAppIcon(apkPath, iconPath); err == nil {
		t.Fatal("expected missing launcher resource error")
	}
	after, err := os.ReadFile(apkPath)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(before, after) {
		t.Fatal("APK changed after failed icon patch")
	}
}

func writeAndroidAppIconFixture(t *testing.T, path string, includeAllIcons bool) {
	t.Helper()
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	writer := zip.NewWriter(file)
	entries := []string{"assets/untouched.bin"}
	if includeAllIcons {
		for name := range discordIconEntries() {
			entries = append(entries, name)
		}
	} else {
		entries = append(entries, "res/mipmap-mdpi-v4/brand_inverted.webp")
	}
	for _, name := range entries {
		entry, err := writer.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if name == "assets/untouched.bin" {
			if _, err := entry.Write([]byte("unchanged")); err != nil {
				t.Fatal(err)
			}
			continue
		}
		if _, err := entry.Write([]byte("stock-icon")); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
}
