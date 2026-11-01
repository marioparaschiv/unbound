package main

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestPullRequestChangeDetectionRunsWithoutACheckout(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	workflow, err := os.ReadFile(filepath.Join(root, "..", "..", ".github", "workflows", "loader-ci.yml"))
	if err != nil {
		t.Fatal(err)
	}
	contents := string(workflow)
	start := strings.Index(contents, "    changes:\n")
	end := strings.Index(contents, "    rehearse-release:\n")
	if start < 0 || end <= start {
		t.Fatal("the change detection job could not be located")
	}
	job := contents[start:end]
	if strings.Contains(job, "actions/checkout") {
		return
	}
	if !strings.Contains(job, "        defaults:\n            run:\n                working-directory: .\n") {
		t.Fatal("the change detection job has no checkout, so its steps must run from the workspace root, not packages/loader")
	}
}
