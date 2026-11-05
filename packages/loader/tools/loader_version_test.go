package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// newLoaderRepo commits ios/control at 1.0.0 together with the first change, then one commit per further change,
// interleaving a docs-only and a Markdown-only commit that the loader version must not count.
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

func TestLoaderVersionCountsLoaderCommitsOnly(t *testing.T) {
	root := newLoaderRepo(t, "feat: one", "fix: two", "fix: three")

	version, err := loaderVersion(root)
	if err != nil {
		t.Fatal(err)
	}
	if version != "1.0.3" {
		t.Fatalf("version = %s, want 1.0.3", version)
	}
	if again, _ := loaderVersion(root); again != version {
		t.Fatalf("version changed between runs: %s then %s", version, again)
	}
}

func TestLoaderVersionKeepsTheControlMajorAndMinor(t *testing.T) {
	root := newLoaderRepo(t, "feat: one")
	writeLoaderControl(t, filepath.Join(root, "ios", "control"), "2.3.0")
	commitGit(t, root, "chore(release): loader 2.3")

	version, err := loaderVersion(root)
	if err != nil {
		t.Fatal(err)
	}
	if version != "2.3.2" {
		t.Fatalf("version = %s, want 2.3.2", version)
	}
}

func TestLoaderVersionRefusesAShallowCheckout(t *testing.T) {
	source := newLoaderRepo(t, "feat: one", "fix: two")
	clone := filepath.Join(t.TempDir(), "clone")
	runGit(t, filepath.Dir(clone), "clone", "-q", "--depth", "1", "file://"+source, clone)

	if _, err := loaderVersion(clone); err == nil || !strings.Contains(err.Error(), "shallow") {
		t.Fatalf("expected a shallow checkout error, got %v", err)
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
