package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// androidSDKVariables are trusted as set; the standard locations only count when they exist.
var androidSDKVariables = []string{"ANDROID_HOME", "ANDROID_SDK_ROOT"}

func androidSDKLocations(home string) []string {
	if home == "" {
		return nil
	}
	return []string{
		filepath.Join(home, "Android", "Sdk"),
		filepath.Join(home, "Library", "Android", "sdk"),
		filepath.Join(home, "android-sdk"),
	}
}

// androidSDKSearchPath lists every place an SDK may be, for callers that look for one file inside it.
func androidSDKSearchPath() []string {
	var paths []string
	for _, variable := range androidSDKVariables {
		if value := os.Getenv(variable); value != "" {
			paths = append(paths, value)
		}
	}
	home, _ := os.UserHomeDir()
	return append(paths, androidSDKLocations(home)...)
}

// findAndroidSDK returns the SDK path, or "" with every place it checked.
func findAndroidSDK(getenv func(string) string, home string, exists func(string) bool) (string, []string) {
	var checked []string
	for _, variable := range androidSDKVariables {
		if value := getenv(variable); value != "" {
			return value, nil
		}
		checked = append(checked, "$"+variable)
	}
	for _, location := range androidSDKLocations(home) {
		if exists(location) {
			return location, nil
		}
		checked = append(checked, location)
	}
	return "", checked
}

func localAndroidSDK() (string, []string) {
	home, _ := os.UserHomeDir()
	return findAndroidSDK(os.Getenv, home, func(path string) bool {
		info, err := os.Stat(path)
		return err == nil && info.IsDir()
	})
}

// androidGradleEnvironment is the environment for Gradle builds that configure :module, which needs the Android SDK.
func androidGradleEnvironment() ([]string, error) {
	sdk, checked := localAndroidSDK()
	if sdk == "" {
		return nil, fmt.Errorf("Android SDK not found; install it or set ANDROID_HOME (checked %s)", strings.Join(checked, ", "))
	}
	environment := os.Environ()
	if os.Getenv("ANDROID_HOME") == "" {
		environment = append(environment, "ANDROID_HOME="+sdk)
	}
	return environment, nil
}
