package main

import (
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"
)

func loaderBuildFilters(t *testing.T) []pathFilter {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("..", "..", "..", ".github", "workflows", "loader-build.yml"))
	if err != nil {
		t.Fatal(err)
	}
	filters, err := pushPathFilters(string(data))
	if err != nil {
		t.Fatal(err)
	}
	return filters
}

func TestBuildWatchReadsTheLoaderBuildPushPaths(t *testing.T) {
	filters := loaderBuildFilters(t)
	for files, want := range map[string]bool{
		"packages/loader/tools/smoke_faults.go":     true,
		".github/workflows/loader-android.yml":      true,
		".github/actions/setup-go-tools/action.yml": true,
		"packages/loader/README.md":                 false,
		"packages/client/src/core/index.ts":         false,
	} {
		if got := triggersBuild(filters, []string{files}); got != want {
			t.Errorf("%s triggers a build: %v, want %v", files, got, want)
		}
	}
}

func TestBuildWatchFlagsOnlyOldEnoughCommitsWithoutRuns(t *testing.T) {
	now := time.Date(2026, 10, 31, 12, 0, 0, 0, time.UTC)
	log := "\x1eaaa " + itoa(now.Add(-2*time.Hour)) + "\n\npackages/loader/tools/a.go\n" +
		"\x1ebbb " + itoa(now.Add(-2*time.Hour)) + "\n\npackages/loader/tools/b.go\n" +
		"\x1eccc " + itoa(now.Add(-5*time.Minute)) + "\n\npackages/loader/tools/c.go\n" +
		"\x1eddd " + itoa(now.Add(-3*time.Hour)) + "\n\npackages/client/src/x.ts\n"
	missing := commitsWithoutBuilds(parseMainCommits(log), loaderBuildFilters(t), map[string]bool{"bbb": true}, now, 30*time.Minute)
	if len(missing) != 1 || missing[0].SHA != "aaa" {
		t.Fatalf("missing builds %+v, want only aaa", missing)
	}
}

func itoa(at time.Time) string {
	return strconv.FormatInt(at.Unix(), 10)
}
