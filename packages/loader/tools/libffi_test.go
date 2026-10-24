package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"testing"
	"time"
)

func TestLibFFIConfigureDisablesGCCMultiOSDirectory(t *testing.T) {
	args := libFFIConfigureArgs("arm64")
	if !slices.Contains(args, "--disable-multi-os-directory") {
		t.Fatal("libffi configure must disable the GCC-only multi-os-directory probe")
	}
}

func TestLibFFIConfigurePlaceholdersAreRemovedBeforeMake(t *testing.T) {
	buildDirectory := t.TempDir()
	placeholderPaths := []string{
		"libffi.la",
		"src/prep_cif.lo",
		"src/aarch64/ffi.lo",
		"src/aarch64/sysv.lo",
	}
	for _, relativePath := range placeholderPaths {
		path := filepath.Join(buildDirectory, relativePath)
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, nil, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if err := clearLibFFIConfigurePlaceholders(buildDirectory); err != nil {
		t.Fatal(err)
	}
	for _, relativePath := range placeholderPaths {
		if _, err := os.Stat(filepath.Join(buildDirectory, relativePath)); !os.IsNotExist(err) {
			t.Fatalf("configure placeholder %q still exists", relativePath)
		}
	}
}

func TestLibFFIMakeDoesNotRerunConfigureOnCoarseTimestampFilesystems(t *testing.T) {
	args := libFFIMakeArgs()
	if !slices.Contains(args, "-B") || !slices.Contains(args, "-o") || !slices.Contains(args, "config.status") || slices.Contains(args, "-C") {
		t.Fatal("libffi make must not rerun config.status after placeholders are cleared")
	}
}

func TestLibFFIMakeEnvironmentRemovesInheritedRecursiveFlags(t *testing.T) {
	environment := libFFIMakeEnvironment([]string{
		"PATH=/bin",
		"MAKEFLAGS=-t",
		"MFLAGS=-n",
		"GNUMAKEFLAGS=-s",
		"MAKEOVERRIDES=DEBUG=1",
		"MAKELEVEL=2",
		"LANG=C",
	})
	if !slices.Equal(environment, []string{"PATH=/bin", "LANG=C"}) {
		t.Fatalf("recursive make flags were not removed: %v", environment)
	}
}

func TestLibFFIBuildLockSerializesConcurrentBuilds(t *testing.T) {
	lockPath := filepath.Join(t.TempDir(), "libffi-build.lock")
	releaseFirst, err := acquireLibFFIBuildLock(lockPath)
	if err != nil {
		t.Fatal(err)
	}

	type lockResult struct {
		release func()
		err     error
	}
	secondResult := make(chan lockResult, 1)
	started := make(chan struct{})
	go func() {
		close(started)
		release, err := acquireLibFFIBuildLock(lockPath)
		secondResult <- lockResult{release: release, err: err}
	}()
	<-started

	select {
	case result := <-secondResult:
		if result.release != nil {
			result.release()
		}
		releaseFirst()
		t.Fatalf("second build acquired the lock before the first released it: %v", result.err)
	case <-time.After(200 * time.Millisecond):
	}

	releaseFirst()
	select {
	case result := <-secondResult:
		if result.err != nil {
			t.Fatal(result.err)
		}
		result.release()
	case <-time.After(2 * time.Second):
		t.Fatal("second build did not acquire the lock after it was released")
	}
}

func TestLibFFIBuildLockWorkerProcess(t *testing.T) {
	lockPath := os.Getenv("LOADER_IOS_LIBFFI_LOCK_PATH")
	if lockPath == "" {
		return
	}
	release, err := acquireLibFFIBuildLock(lockPath)
	if err != nil {
		t.Fatal(err)
	}
	defer release()
	if err := os.WriteFile(os.Getenv("LOADER_IOS_LIBFFI_LOCK_MARKER"), nil, 0o600); err != nil {
		t.Fatal(err)
	}
}

func TestLibFFIBuildLockSerializesSeparateProcesses(t *testing.T) {
	lockPath := filepath.Join(t.TempDir(), "libffi-build.lock")
	markerPath := filepath.Join(t.TempDir(), "acquired")
	releaseFirst, err := acquireLibFFIBuildLock(lockPath)
	if err != nil {
		t.Fatal(err)
	}

	command := exec.Command(os.Args[0], "-test.run=^TestLibFFIBuildLockWorkerProcess$")
	command.Env = append(os.Environ(), "LOADER_IOS_LIBFFI_LOCK_PATH="+lockPath, "LOADER_IOS_LIBFFI_LOCK_MARKER="+markerPath)
	if err := command.Start(); err != nil {
		releaseFirst()
		t.Fatal(err)
	}
	commandResult := make(chan error, 1)
	go func() {
		commandResult <- command.Wait()
	}()

	select {
	case err := <-commandResult:
		releaseFirst()
		t.Fatalf("second process exited before the first released the lock: %v", err)
	case <-time.After(200 * time.Millisecond):
	}
	if _, err := os.Stat(markerPath); !os.IsNotExist(err) {
		releaseFirst()
		t.Fatal("second process acquired the lock before the first released it")
	}

	releaseFirst()
	select {
	case err := <-commandResult:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("second process did not acquire the lock after it was released")
	}
	if _, err := os.Stat(markerPath); err != nil {
		t.Fatal(err)
	}
}

func TestLibFFIBuildIsSkippedOnlyWhenTheStampMatchesItsOutputs(t *testing.T) {
	directory := t.TempDir()
	archive := filepath.Join(directory, "libffi.a")
	include := filepath.Join(directory, "include")
	key := libFFIBuildKey("12ffd1f9dc56fcea79d2f742f424301ae668d663")
	if libFFIUpToDate(archive, include, key) {
		t.Fatal("a missing build was reported as up to date")
	}
	if err := os.MkdirAll(include, 0o755); err != nil {
		t.Fatal(err)
	}
	for _, path := range append([]string{archive}, prefixPaths(include, libFFIHeaders)...) {
		if err := os.WriteFile(path, []byte("built"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if libFFIUpToDate(archive, include, key) {
		t.Fatal("a build without a stamp was reported as up to date")
	}
	if err := os.WriteFile(libFFIStampPath(archive), []byte(key), 0o644); err != nil {
		t.Fatal(err)
	}
	if !libFFIUpToDate(archive, include, key) {
		t.Fatal("a stamped build with every output was rebuilt")
	}
	if libFFIUpToDate(archive, include, libFFIBuildKey("0000000000000000000000000000000000000000")) {
		t.Fatal("a build for another libffi revision was reported as up to date")
	}
	if err := os.Remove(filepath.Join(include, "ffi.h")); err != nil {
		t.Fatal(err)
	}
	if libFFIUpToDate(archive, include, key) {
		t.Fatal("a build missing a header was reported as up to date")
	}
}
