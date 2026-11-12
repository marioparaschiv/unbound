package main

import (
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func writeJSIHeaders(t *testing.T, root, vendored, hermes string) {
	t.Helper()
	for path, contents := range map[string]string{
		filepath.Join(root, "vendor", "react", "jsi", "jsi.h"):                   vendored,
		filepath.Join(root, "build", "hermes-src", "API", "jsi", "jsi", "jsi.h"): hermes,
	} {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
			t.Fatal(err)
		}
	}
}

func TestHermesCoreTestsReuseTheCheckoutAndRunEveryHermesTest(t *testing.T) {
	root := t.TempDir()
	writeJSIHeaders(t, root, "jsi", "jsi")
	var calls []string
	runner := func(_ string, name string, args []string, _ []string, _, _ io.Writer) error {
		calls = append(calls, name+" "+strings.Join(args, " "))
		return nil
	}
	if err := runHermesCoreTests(root, runner); err != nil {
		t.Fatal(err)
	}
	if len(calls) != 3 || !strings.Contains(calls[0], "-DUNBOUND_CORE_JSI_FUZZ=ON") ||
		!strings.Contains(calls[0], "-DUNBOUND_HERMES_SOURCE_DIR="+filepath.Join(root, "build", "hermes-src")) ||
		!strings.HasPrefix(calls[1], "cmake --build ") || !strings.HasSuffix(calls[2], "-R _hermes$") {
		t.Fatalf("unexpected Hermes test command sequence: %#v", calls)
	}
}

func TestHermesCoreTestsCloneThePinnedTagWhenMissing(t *testing.T) {
	root := t.TempDir()
	var clone string
	runner := func(_ string, name string, args []string, _ []string, _, _ io.Writer) error {
		if name == "git" {
			clone = strings.Join(args, " ")
			return io.ErrUnexpectedEOF
		}
		return nil
	}
	if err := runHermesCoreTests(root, runner); err == nil {
		t.Fatal("a failed clone must fail the run")
	}
	if !strings.Contains(clone, "--branch "+hermesTag) {
		t.Fatalf("the clone must fetch %s, ran git %s", hermesTag, clone)
	}
}

func TestHermesCoreTestsRejectAMismatchedCheckout(t *testing.T) {
	root := t.TempDir()
	writeJSIHeaders(t, root, "jsi", "other")
	runner := func(string, string, []string, []string, io.Writer, io.Writer) error { return nil }
	err := runHermesCoreTests(root, runner)
	if err == nil || !strings.Contains(err.Error(), "differs from vendor/react/jsi/jsi.h") {
		t.Fatalf("a checkout whose jsi.h differs must be rejected, got %v", err)
	}
}

func TestHermesCoreTestsUseTheTagCIBuilds(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	workflow, err := os.ReadFile(filepath.Join(root, "..", "..", ".github", "workflows", "loader-core.yml"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(workflow), "HERMES_TAG: "+hermesTag+"\n") {
		t.Fatalf("loader-core.yml must build Hermes %s, the tag core-test --hermes fetches", hermesTag)
	}
	if !strings.Contains(string(workflow), "-R '_hermes$'") {
		t.Fatal("loader-core.yml must run every Hermes test through ctest, so new ones run without a list")
	}
}
