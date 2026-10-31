package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestEveryVendoredFolderIsDeclared(t *testing.T) {
	root := ".."
	components, err := readVendoredComponents(root)
	if err != nil {
		t.Fatal(err)
	}
	declared := map[string]bool{}
	for _, component := range components {
		declared[component.Path] = true
	}
	entries, err := os.ReadDir(filepath.Join(root, "vendor"))
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range entries {
		if entry.IsDir() && !declared["vendor/"+entry.Name()] {
			t.Fatalf("vendor/%s is not listed in vendor/versions.json", entry.Name())
		}
	}
}

func TestLoaderSBOMDescribesEveryVendoredComponent(t *testing.T) {
	document, err := buildLoaderSBOM("..", "1.2.3", "abc123", time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	components, err := readVendoredComponents("..")
	if err != nil {
		t.Fatal(err)
	}
	if document.SPDXVersion != "SPDX-2.3" || document.CreationInfo.Created != "2026-10-30T00:00:00Z" {
		t.Fatalf("unexpected document header: %+v", document)
	}
	if len(document.Packages) != len(components)+1 || len(document.Relationships) != len(components)+1 {
		t.Fatalf("want the loader plus %d components, got %d packages", len(components), len(document.Packages))
	}
	for _, pkg := range document.Packages[1:] {
		if len(pkg.Checksums) != 1 || len(pkg.Checksums[0].ChecksumValue) != 64 {
			t.Fatalf("%s needs a SHA-256 of its files, got %+v", pkg.Name, pkg.Checksums)
		}
		if pkg.VersionInfo == "" && pkg.Name != "Monocypher" {
			t.Fatalf("%s has no version", pkg.Name)
		}
	}
}

func TestDirectoryDigestChangesWithContents(t *testing.T) {
	directory := t.TempDir()
	if err := os.WriteFile(filepath.Join(directory, "a.c"), []byte("one"), 0o644); err != nil {
		t.Fatal(err)
	}
	first, err := directoryDigest(directory)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(directory, "a.c"), []byte("two"), 0o644); err != nil {
		t.Fatal(err)
	}
	second, err := directoryDigest(directory)
	if err != nil {
		t.Fatal(err)
	}
	if first == second {
		t.Fatal("the digest must change when a file changes")
	}
}
