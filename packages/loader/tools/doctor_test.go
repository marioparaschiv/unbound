package main

import (
	"errors"
	"path/filepath"
	"testing"
)

func fakeDoctorEnvironment(commands []string, env map[string]string, paths []string) doctorEnvironment {
	available := map[string]bool{}
	for _, command := range commands {
		available[command] = true
	}
	present := map[string]bool{}
	for _, path := range paths {
		present[path] = true
	}
	return doctorEnvironment{
		goos: "darwin",
		lookPath: func(name string) error {
			if available[name] {
				return nil
			}
			return errors.New("not found")
		},
		getenv: func(key string) string { return env[key] },
		exists: func(path string) bool { return present[path] },
		home:   "/home",
		ndk:    "27.3.13750724",
	}
}

func doctorResultFor(t *testing.T, results []doctorResult, name string) doctorResult {
	t.Helper()
	for _, result := range results {
		if result.check.name == name {
			return result
		}
	}
	t.Fatalf("no %s check", name)
	return doctorResult{}
}

func TestDoctorFindsThePinnedNDKInTheDefaultSDK(t *testing.T) {
	sdk := filepath.Join("/home", "Library", "Android", "sdk")
	environment := fakeDoctorEnvironment(nil, nil, []string{sdk, filepath.Join(sdk, "ndk", "27.3.13750724")})
	results := runDoctorChecks(doctorChecks(environment), environment)
	if !doctorResultFor(t, results, "Android SDK").ok || !doctorResultFor(t, results, "Android NDK 27.3.13750724").ok {
		t.Fatal("the SDK and NDK in ~/Library/Android/sdk were not found")
	}
	if doctorResultFor(t, results, "DKRYPT_API_KEY").ok {
		t.Fatal("an unset dkrypt key passed")
	}
}

func TestDoctorOnlyFailsOptionalChecksWhenStrict(t *testing.T) {
	required := []string{"git", "go", "unzip", "bun", "otool", "gmake", "ldid", "xcodebuild", "codesign"}
	environment := fakeDoctorEnvironment(required, nil, nil)
	results := runDoctorChecks(doctorChecks(environment), environment)
	if failures := doctorFailures(results, false); failures != 0 {
		t.Fatalf("%d failures without strict", failures)
	}
	if failures := doctorFailures(results, true); failures == 0 {
		t.Fatal("strict mode ignored the missing Android tools")
	}
}

func TestDoctorReadsTheNDKVersionFromTheModuleBuild(t *testing.T) {
	if got := pinnedNDKVersion(filepath.Join("..", "android", "module", "build.gradle.kts")); got == "" {
		t.Fatal("the module build has no pinned NDK version")
	}
}
