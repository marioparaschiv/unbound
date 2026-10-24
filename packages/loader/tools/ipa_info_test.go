package main

import (
	"archive/zip"
	"os"
	"path/filepath"
	"testing"
)

func TestReadIPAMetadata(t *testing.T) {
	path := filepath.Join(t.TempDir(), "app.ipa")
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	archive := zip.NewWriter(file)
	entry, err := archive.Create("Payload/Discord.app/Info.plist")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := entry.Write([]byte(`<?xml version="1.0"?><plist><dict><key>CFBundleShortVersionString</key><string>341.0</string><key>CFBundleVersion</key><string>107981</string></dict></plist>`)); err != nil {
		t.Fatal(err)
	}
	if err := archive.Close(); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}

	metadata, err := readIPAMetadata(path)
	if err != nil {
		t.Fatal(err)
	}
	if metadata.Version != "341.0" || metadata.Build != "107981" {
		t.Fatalf("unexpected metadata: %#v", metadata)
	}
}

func TestReadIPAMetadataRejectsMissingPlist(t *testing.T) {
	path := filepath.Join(t.TempDir(), "app.ipa")
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	archive := zip.NewWriter(file)
	if _, err := archive.Create("Payload/Discord.app/Discord"); err != nil {
		t.Fatal(err)
	}
	if err := archive.Close(); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
	if _, err := readIPAMetadata(path); err == nil {
		t.Fatal("expected missing Info.plist error")
	}
}
