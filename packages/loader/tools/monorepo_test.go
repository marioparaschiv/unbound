package main

import (
	"io"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"testing"
)

func TestPlatformAndroidBuildUsesGradleTargetForConfiguration(t *testing.T) {
	var gotRoot string
	var gotName string
	var gotArgs []string
	runner := func(root, name string, args []string, env []string, stdout, stderr io.Writer) error {
		gotRoot = root
		gotName = name
		gotArgs = append([]string(nil), args...)
		return nil
	}
	if err := runPlatformWithRunner("build", "android", "/repo", "release", runner); err != nil {
		t.Fatal(err)
	}
	if gotRoot != "/repo/android" || gotName != "./gradlew" {
		t.Fatalf("unexpected Android build target: %s %s", gotRoot, gotName)
	}
	if !reflect.DeepEqual(gotArgs, []string{":module:assembleRelease", "--no-daemon", "--quiet", "--console=plain"}) {
		t.Fatalf("unexpected Android build arguments: %#v", gotArgs)
	}
	if err := runPlatformWithRunner("build", "android", "/repo", "debug", runner); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(gotArgs, []string{":module:assembleDebug", "--no-daemon", "--quiet", "--console=plain"}) {
		t.Fatalf("unexpected Android debug build arguments: %#v", gotArgs)
	}
}

func TestPlatformRejectsUnknownActionAndPlatform(t *testing.T) {
	runner := func(string, string, []string, []string, io.Writer, io.Writer) error { return nil }
	if err := runPlatformWithRunner("ship", "android", "/repo", "release", runner); err == nil {
		t.Fatal("expected an unknown action error")
	}
	if err := runPlatformWithRunner("build", "macos", "/repo", "release", runner); err == nil {
		t.Fatal("expected an unknown platform error")
	}
}

func TestRunCoreTestsUsesSanitizersAndRunsCTest(t *testing.T) {
	var calls []string
	runner := func(root, name string, args []string, env []string, stdout, stderr io.Writer) error {
		calls = append(calls, name+" "+strings.Join(args, " "))
		return nil
	}
	if err := runCoreTests("/repo", runner); err != nil {
		t.Fatal(err)
	}
	if len(calls) != 3 || !strings.Contains(calls[0], "-fsanitize=address,undefined") ||
		!strings.HasPrefix(calls[1], "cmake --build ") || !strings.HasPrefix(calls[2], "ctest --test-dir ") {
		t.Fatalf("unexpected core test command sequence: %#v", calls)
	}
}

func TestValidateSubmoduleOutput(t *testing.T) {
	if err := validateSubmoduleOutput(" 1234567890 resources (heads/main)\n"); err != nil {
		t.Fatalf("recorded submodule revision rejected: %v", err)
	}
	for _, prefix := range []string{"-", "+", "U"} {
		if err := validateSubmoduleOutput(prefix + "1234567890 resources (heads/main)\n"); err == nil {
			t.Fatalf("submodule status %q was accepted", prefix)
		}
	}
}

func TestValidateWorkspaceManifestRequiresEveryPackageRootToBeRegistered(t *testing.T) {
	root := t.TempDir()
	packages := root
	for _, name := range []string{"core", "ios", "unregistered"} {
		if err := os.MkdirAll(filepath.Join(packages, name), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	manifest := workspaceManifest{
		Name: "astral-loader",
		Packages: []workspaceModule{
			{Name: "core", Path: "core", Kind: "shared"},
			{Name: "ios", Path: "ios", Kind: "platform", Dependencies: []string{"core"}},
		},
	}
	if err := validateWorkspaceManifest(root, manifest); err == nil || !strings.Contains(err.Error(), "unregistered") {
		t.Fatalf("expected unregistered package root error, got %v", err)
	}
}

func TestValidateWorkspaceManifestRejectsInvalidPackages(t *testing.T) {
	root := t.TempDir()
	packages := root
	if err := os.MkdirAll(filepath.Join(packages, "core", "runtime"), 0o755); err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		name     string
		manifest workspaceManifest
		contains string
	}{
		{
			name: "duplicate name",
			manifest: workspaceManifest{Name: "workspace", Packages: []workspaceModule{
				{Name: "core", Path: "core", Kind: "shared"},
				{Name: "core", Path: "core/child", Kind: "shared"},
			}},
			contains: "duplicate workspace package name",
		},
		{
			name: "outside the loader root",
			manifest: workspaceManifest{Name: "workspace", Packages: []workspaceModule{
				{Name: "core", Path: "../core", Kind: "shared"},
			}},
			contains: "must be a path inside the loader root",
		},
		{
			name: "unknown dependency",
			manifest: workspaceManifest{Name: "workspace", Packages: []workspaceModule{
				{Name: "core", Path: "core", Kind: "shared", Dependencies: []string{"missing"}},
			}},
			contains: "unknown dependency",
		},
		{
			name: "dependency cycle",
			manifest: workspaceManifest{Name: "workspace", Packages: []workspaceModule{
				{Name: "core", Path: "core", Kind: "shared", Dependencies: []string{"runtime"}},
				{Name: "runtime", Path: "core/runtime", Kind: "platform", Dependencies: []string{"core"}},
			}},
			contains: "dependency cycle",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateWorkspaceManifest(root, test.manifest)
			if err == nil || !strings.Contains(err.Error(), test.contains) {
				t.Fatalf("expected %q error, got %v", test.contains, err)
			}
		})
	}
}

func TestRepositoryWorkspaceManifestIsValid(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	if err := validateWorkspace(root); err != nil {
		t.Fatal(err)
	}
}

func TestPrintWorkspacePackagesSortsPackagesAndDependencies(t *testing.T) {
	var output strings.Builder
	packages := []workspaceModule{
		{Name: "zeta", Path: "packages/zeta", Kind: "platform"},
		{Name: "alpha", Path: "packages/alpha", Kind: "shared", Dependencies: []string{"zeta", "beta"}},
	}
	if err := printWorkspacePackages(&output, packages); err != nil {
		t.Fatal(err)
	}
	want := "alpha\tshared\tpackages/alpha\tdepends on: beta, zeta\nzeta\tplatform\tpackages/zeta\n"
	if output.String() != want {
		t.Fatalf("unexpected workspace listing:\n%s", output.String())
	}
}

func TestValidateWorkspaceIgnoresUntrackedDirectoriesInAGitCheckout(t *testing.T) {
	root := t.TempDir()
	for _, name := range []string{"core", "arm64-astral.dylib.dSYM"} {
		if err := os.MkdirAll(filepath.Join(root, name), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(root, "core", "CMakeLists.txt"), []byte("project(core)\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	for _, args := range [][]string{{"init", "-q"}, {"add", "core/CMakeLists.txt"}} {
		if err := defaultRunner(root, "git", args, os.Environ(), io.Discard, io.Discard); err != nil {
			t.Fatal(err)
		}
	}
	manifest := workspaceManifest{Name: "astral-loader", Packages: []workspaceModule{{Name: "core", Path: "core", Kind: "shared"}}}
	if err := validateWorkspaceManifest(root, manifest); err != nil {
		t.Fatalf("an untracked build artifact directory must not fail validation: %v", err)
	}
}
