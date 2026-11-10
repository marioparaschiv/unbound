package main

import (
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestFindAndroidSDKPrefersVariablesThenStandardLocations(t *testing.T) {
	home := filepath.Join("/home", "dev")
	variables := map[string]string{}
	getenv := func(key string) string { return variables[key] }
	existing := map[string]bool{filepath.Join(home, "android-sdk"): true}
	exists := func(path string) bool { return existing[path] }

	if sdk, _ := findAndroidSDK(getenv, home, exists); sdk != filepath.Join(home, "android-sdk") {
		t.Fatalf("found %q, want ~/android-sdk", sdk)
	}
	existing[filepath.Join(home, "Android", "Sdk")] = true
	if sdk, _ := findAndroidSDK(getenv, home, exists); sdk != filepath.Join(home, "Android", "Sdk") {
		t.Fatalf("found %q, want ~/Android/Sdk first", sdk)
	}
	variables["ANDROID_SDK_ROOT"] = "/opt/sdk-root"
	if sdk, _ := findAndroidSDK(getenv, home, exists); sdk != "/opt/sdk-root" {
		t.Fatalf("found %q, want ANDROID_SDK_ROOT", sdk)
	}
	variables["ANDROID_HOME"] = "/opt/sdk"
	if sdk, _ := findAndroidSDK(getenv, home, exists); sdk != "/opt/sdk" {
		t.Fatalf("found %q, want ANDROID_HOME", sdk)
	}
}

func TestFindAndroidSDKNamesEveryCheckedPlace(t *testing.T) {
	home := filepath.Join("/home", "dev")
	sdk, checked := findAndroidSDK(func(string) string { return "" }, home, func(string) bool { return false })
	if sdk != "" {
		t.Fatalf("found %q in an empty environment", sdk)
	}
	want := append([]string{"$ANDROID_HOME", "$ANDROID_SDK_ROOT"}, androidSDKLocations(home)...)
	if !reflect.DeepEqual(checked, want) {
		t.Fatalf("checked %v, want %v", checked, want)
	}
}

func TestAndroidGradleEnvironmentErrorsWithoutSDK(t *testing.T) {
	t.Setenv("ANDROID_HOME", "")
	t.Setenv("ANDROID_SDK_ROOT", "")
	t.Setenv("HOME", t.TempDir())
	_, err := androidGradleEnvironment()
	if err == nil || !strings.Contains(err.Error(), "$ANDROID_HOME") || !strings.Contains(err.Error(), "android-sdk") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestAndroidGradleEnvironmentExportsFoundSDK(t *testing.T) {
	home := t.TempDir()
	t.Setenv("ANDROID_HOME", "")
	t.Setenv("ANDROID_SDK_ROOT", "")
	t.Setenv("HOME", home)
	sdk := filepath.Join(home, "Android", "Sdk")
	if err := os.MkdirAll(sdk, 0o755); err != nil {
		t.Fatal(err)
	}
	environment, err := androidGradleEnvironment()
	if err != nil {
		t.Fatal(err)
	}
	if environment[len(environment)-1] != "ANDROID_HOME="+sdk {
		t.Fatalf("ANDROID_HOME was not exported: %v", environment[len(environment)-1])
	}
}
