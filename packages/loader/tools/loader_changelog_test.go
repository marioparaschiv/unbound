package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestGenerateLoaderChangelogUsesLoaderVersionChanges(t *testing.T) {
	root := t.TempDir()
	runGit(t, root, "init", "-q")
	runGit(t, root, "config", "user.name", "Codex")
	runGit(t, root, "config", "user.email", "codex@example.com")

	controlPath := filepath.Join(root, "ios", "control")
	if err := os.MkdirAll(filepath.Dir(controlPath), 0o755); err != nil {
		t.Fatal(err)
	}
	writeLoaderControl(t, controlPath, "0.9.0")
	commitGit(t, root, "chore(release): loader 0.9.0")

	writeLoaderChange(t, root, "feat(native): add Android UI handles")
	commitGit(t, root, "feat(native): add Android UI handles")
	writeLoaderChange(t, root, "fix(plugins): reject stale UI snapshots")
	commitGit(t, root, "fix(plugins): reject stale UI snapshots")

	writeLoaderControl(t, controlPath, "1.0.0")
	commitGit(t, root, "chore(release): loader 1.0.0")

	changelog, err := generateLoaderChangelog(root, "1.0.0")
	if err != nil {
		t.Fatal(err)
	}
	for _, expected := range []string{
		"# Loader 1.0.0",
		"## Features",
		"**native:** Add Android UI handles",
		"## Fixes",
		"**plugins:** Reject stale UI snapshots",
	} {
		if !strings.Contains(changelog, expected) {
			t.Fatalf("loader changelog omitted %q: %s", expected, changelog)
		}
	}
	if strings.Contains(changelog, "Discord") || strings.Contains(changelog, "0.9.0") {
		t.Fatalf("loader changelog contains a Discord version or previous release: %s", changelog)
	}
}

func TestGenerateLoaderChangelogRequiresPackageSemver(t *testing.T) {
	root := t.TempDir()
	controlPath := filepath.Join(root, "ios", "control")
	if err := os.MkdirAll(filepath.Dir(controlPath), 0o755); err != nil {
		t.Fatal(err)
	}
	writeLoaderControl(t, controlPath, "1.0.0")
	runGit(t, root, "init", "-q")
	runGit(t, root, "config", "user.name", "Codex")
	runGit(t, root, "config", "user.email", "codex@example.com")
	commitGit(t, root, "chore(release): loader 1.0.0")

	if _, err := generateLoaderChangelog(root, "1.0.1"); err == nil || !strings.Contains(err.Error(), "does not match package version") {
		t.Fatalf("expected a package version mismatch, got %v", err)
	}
}

func TestRenderLoaderChangelogGroupsBreakingAndMaintenanceChanges(t *testing.T) {
	changelog := renderLoaderChangelog("1.2.3", []string{
		"feat(native)!: replace Objective-C selector API",
		"chore(build): update SDK tooling",
		"Merge pull request #5",
	})
	for _, expected := range []string{
		"# Loader 1.2.3",
		"## Breaking Changes",
		"**native:** Replace Objective-C selector API",
		"## Maintenance",
		"**build:** Update SDK tooling",
	} {
		if !strings.Contains(changelog, expected) {
			t.Fatalf("loader changelog omitted %q: %s", expected, changelog)
		}
	}
	if strings.Contains(changelog, "## Features") || strings.Contains(changelog, "## Other Changes") {
		t.Fatalf("loader changelog contains an empty or unneeded category: %s", changelog)
	}
}

func writeLoaderControl(t *testing.T, path string, version string) {
	t.Helper()
	contents := "Name: astral\nVersion: " + version + "\nPackage: app.astral.ios\n"
	if err := os.WriteFile(path, []byte(contents), 0o600); err != nil {
		t.Fatal(err)
	}
}

func writeLoaderChange(t *testing.T, root string, content string) {
	t.Helper()
	path := filepath.Join(root, "ios", "source.txt")
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}

func commitGit(t *testing.T, root string, message string) {
	t.Helper()
	runGit(t, root, "add", ".")
	runGit(t, root, "commit", "-m", message)
}

func runGit(t *testing.T, root string, args ...string) {
	t.Helper()
	command := exec.Command("git", args...)
	command.Dir = root
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v failed: %v\n%s", args, err, output)
	}
}
