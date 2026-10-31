package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
)

type doctorCheck struct {
	name     string
	required bool
	hint     string
	passes   func(doctorEnvironment) bool
}

type doctorEnvironment struct {
	goos     string
	lookPath func(string) error
	getenv   func(string) string
	exists   func(string) bool
	home     string
	ndk      string
}

type doctorResult struct {
	check doctorCheck
	ok    bool
}

func systemDoctorEnvironment() doctorEnvironment {
	home, _ := os.UserHomeDir()
	return doctorEnvironment{
		goos: runtime.GOOS,
		lookPath: func(name string) error {
			_, err := exec.LookPath(name)
			return err
		},
		getenv: os.Getenv,
		exists: func(path string) bool {
			_, err := os.Stat(path)
			return err == nil
		},
		home: home,
		ndk:  pinnedNDKVersion(filepath.Join("android", "module", "build.gradle.kts")),
	}
}

var ndkVersionPattern = regexp.MustCompile(`ndkVersion\s*=\s*"([^"]+)"`)

func pinnedNDKVersion(buildFile string) string {
	data, err := os.ReadFile(buildFile)
	if err != nil {
		return ""
	}
	if match := ndkVersionPattern.FindSubmatch(data); match != nil {
		return string(match[1])
	}
	return ""
}

func (environment doctorEnvironment) androidSDK() string {
	for _, key := range []string{"ANDROID_HOME", "ANDROID_SDK_ROOT"} {
		if value := environment.getenv(key); value != "" {
			return value
		}
	}
	if environment.home == "" {
		return ""
	}
	sdk := filepath.Join(environment.home, "Library", "Android", "sdk")
	if environment.exists(sdk) {
		return sdk
	}
	return ""
}

func commandCheck(name string, required bool, hint string) doctorCheck {
	return doctorCheck{name: name, required: required, hint: hint, passes: func(environment doctorEnvironment) bool {
		return environment.lookPath(name) == nil
	}}
}

func doctorChecks(environment doctorEnvironment) []doctorCheck {
	checks := []doctorCheck{
		commandCheck("git", true, "install git"),
		commandCheck("go", true, "install the Go version in go.mod"),
		commandCheck("unzip", true, "install unzip"),
		commandCheck("bun", true, "install Bun from bun.sh; the client and plugins build with it"),
	}
	if environment.goos == "darwin" {
		checks = append(checks,
			commandCheck("otool", true, "install the Xcode command line tools"),
			commandCheck("gmake", true, "brew install make"),
			commandCheck("ldid", true, "brew install ldid"),
			commandCheck("xcodebuild", true, "install Xcode and run xcode-select"),
			commandCheck("codesign", true, "install the Xcode command line tools"),
			commandCheck("python3", false, "install Python 3 for the IPA helper scripts"),
			commandCheck("clang", false, "install the Xcode command line tools"),
		)
	} else {
		checks = append(checks, commandCheck("make", true, "install make"))
	}
	checks = append(checks,
		commandCheck("actionlint", false, "brew install actionlint; go run ./tools lint needs it"),
		commandCheck("java", false, "install JDK 17 for the Android module"),
		commandCheck("adb", false, "add the Android SDK platform-tools to PATH for the Android smoke test"),
		doctorCheck{name: "Android SDK", hint: "install the Android SDK or set ANDROID_HOME", passes: func(environment doctorEnvironment) bool {
			return environment.androidSDK() != ""
		}},
		doctorCheck{name: "Android NDK " + environment.ndk, hint: "install NDK " + environment.ndk + " with sdkmanager \"ndk;" + environment.ndk + "\"", passes: func(environment doctorEnvironment) bool {
			sdk := environment.androidSDK()
			return sdk != "" && environment.ndk != "" && environment.exists(filepath.Join(sdk, "ndk", environment.ndk))
		}},
		doctorCheck{name: "DKRYPT_API_KEY", hint: "export DKRYPT_API_KEY to fetch decrypted Discord IPAs", passes: func(environment doctorEnvironment) bool {
			return environment.getenv("DKRYPT_API_KEY") != ""
		}},
	)
	return checks
}

func runDoctorChecks(checks []doctorCheck, environment doctorEnvironment) []doctorResult {
	results := make([]doctorResult, 0, len(checks))
	for _, check := range checks {
		results = append(results, doctorResult{check: check, ok: check.passes(environment)})
	}
	return results
}

func doctorFailures(results []doctorResult, strict bool) int {
	failures := 0
	for _, result := range results {
		if !result.ok && (result.check.required || strict) {
			failures++
		}
	}
	return failures
}

func printDoctorResult(result doctorResult) {
	switch {
	case result.ok:
		fmt.Println("found", result.check.name)
	case result.check.required:
		fmt.Printf("missing %s: %s\n", result.check.name, result.check.hint)
	default:
		fmt.Printf("missing optional %s: %s\n", result.check.name, result.check.hint)
	}
}

func runDoctor(args []string) error {
	set := flag.NewFlagSet("doctor", flag.ContinueOnError)
	strict := set.Bool("strict", false, "fail when optional platform tools are unavailable")
	if err := set.Parse(args); err != nil {
		return err
	}
	environment := systemDoctorEnvironment()
	results := runDoctorChecks(doctorChecks(environment), environment)
	for _, result := range results {
		printDoctorResult(result)
	}
	failures := doctorFailures(results, *strict)
	if _, err := packageName("."); err != nil {
		fmt.Println("missing control package metadata: run doctor from packages/loader")
		failures++
	}
	if failures > 0 {
		return errors.New("doctor found missing requirements")
	}
	return nil
}
