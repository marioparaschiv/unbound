package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestGenerateLoaderChangelogListsTheChangesSinceThePreviousVersion(t *testing.T) {
	root := newLoaderRepo(t, "chore(build): add the loader", "feat(native): add Android UI handles", "fix(plugins): reject stale UI snapshots")

	changelog, err := generateLoaderChangelog(root, "1.0.3", "1.0.1")
	if err != nil {
		t.Fatal(err)
	}
	for _, expected := range []string{
		"# Loader 1.0.3",
		"## Features",
		"**native:** Add Android UI handles",
		"## Fixes",
		"**plugins:** Reject stale UI snapshots",
	} {
		if !strings.Contains(changelog, expected) {
			t.Fatalf("loader changelog omitted %q: %s", expected, changelog)
		}
	}
	if strings.Contains(changelog, "Add the loader") || strings.Contains(changelog, "Document") {
		t.Fatalf("loader changelog lists a change from before 1.0.1 or outside the loader: %s", changelog)
	}
}

func TestGenerateLoaderChangelogListsTheLastChangeWithoutAnOlderPreviousVersion(t *testing.T) {
	root := newLoaderRepo(t, "feat(native): add Android UI handles", "fix(plugins): reject stale UI snapshots")

	for _, previous := range []string{"", "1.0.0", "1.0.2", "not a version"} {
		changelog, err := generateLoaderChangelog(root, "1.0.2", previous)
		if err != nil {
			t.Fatal(err)
		}
		if !strings.Contains(changelog, "Reject stale UI snapshots") || strings.Contains(changelog, "Add Android UI handles") {
			t.Fatalf("previous %q: changelog = %s", previous, changelog)
		}
	}
}

func TestGenerateLoaderChangelogRequiresTheCheckoutsVersion(t *testing.T) {
	root := newLoaderRepo(t, "feat(native): add Android UI handles")

	if _, err := generateLoaderChangelog(root, "1.0.2", ""); err == nil || !strings.Contains(err.Error(), "does not match the checkout's loader version 1.0.1") {
		t.Fatalf("expected a loader version mismatch, got %v", err)
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
	contents := "Name: Unbound\nVersion: " + version + "\nPackage: app.unbound.ios\n"
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
