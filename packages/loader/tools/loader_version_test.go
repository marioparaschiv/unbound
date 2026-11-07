package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func newLoaderRepo(t *testing.T, changes ...string) string {
	t.Helper()
	root := t.TempDir()
	runGit(t, root, "init", "-q")
	runGit(t, root, "config", "user.name", "Codex")
	runGit(t, root, "config", "user.email", "codex@example.com")
	controlPath := filepath.Join(root, "ios", "control")
	if err := os.MkdirAll(filepath.Join(root, "docs"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(controlPath), 0o755); err != nil {
		t.Fatal(err)
	}
	writeLoaderControl(t, controlPath, "1.0.0")
	writeLoaderVersion(t, root, "1.0.0")
	for index, change := range changes {
		writeLoaderChange(t, root, change)
		commitGit(t, root, change)
		if err := os.WriteFile(filepath.Join(root, "docs", "notes.txt"), []byte(change), 0o600); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(root, "README.md"), []byte(change), 0o600); err != nil {
			t.Fatal(err)
		}
		commitGit(t, root, "docs: document change "+string(rune('a'+index)))
	}
	return root
}

func TestLoaderVersionUsesThePackageSemanticVersion(t *testing.T) {
	root := newLoaderRepo(t, "feat: one", "fix: two", "fix: three")

	version, err := loaderVersion(root)
	if err != nil {
		t.Fatal(err)
	}
	if version != "1.0.0" {
		t.Fatalf("version = %s, want package version 1.0.0", version)
	}
	if again, _ := loaderVersion(root); again != version {
		t.Fatalf("version changed between runs: %s then %s", version, again)
	}
}

func TestLoaderVersionReadsTheVersionManifest(t *testing.T) {
	root := newLoaderRepo(t, "feat: one")
	writeLoaderVersion(t, root, "2.3.0")

	version, err := loaderVersion(root)
	if err != nil {
		t.Fatal(err)
	}
	if version != "2.3.0" {
		t.Fatalf("version = %s, want 2.3.0", version)
	}
}

func TestLoaderVersionRejectsMalformedVersionFiles(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "version.json"), []byte(`{"version":"1.0"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := loaderVersion(root); err == nil || !strings.Contains(err.Error(), "semantic versioning 2.0.0") {
		t.Fatalf("expected an invalid semantic version error, got %v", err)
	}
}

func TestStampLoaderVersionRewritesOnlyTheVersionLine(t *testing.T) {
	root := t.TempDir()
	controlPath := filepath.Join(root, "ios", "control")
	if err := os.MkdirAll(filepath.Dir(controlPath), 0o755); err != nil {
		t.Fatal(err)
	}
	writeLoaderControl(t, controlPath, "1.0.0")

	if err := stampLoaderVersion(root, "1.0.42"); err != nil {
		t.Fatal(err)
	}
	contents, err := os.ReadFile(controlPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(contents) != "Name: Unbound\nVersion: 1.0.42\nPackage: app.unbound.ios\n" {
		t.Fatalf("control = %q", contents)
	}
	if err := stampLoaderVersion(root, "1.0"); err == nil {
		t.Fatal("stamped a version that is not semver")
	}
}

func writeLoaderVersion(t *testing.T, root string, version string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(root, "version.json"), []byte("{\"version\":\""+version+"\"}\n"), 0o600); err != nil {
		t.Fatal(err)
	}
}
