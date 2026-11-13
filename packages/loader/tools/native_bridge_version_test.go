package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"testing"
)

// The native bridge API in core/include/NativePluginVersion.h and the first loader release that
// provides it. A bundle built against the API must require that loader, or older loaders refuse it
// without naming a loader the user can install.
const (
	nativeBridgeAPI       = "1.5.0"
	nativeBridgeAPILoader = "1.4.0"
)

var nativeBridgeAPIPattern = regexp.MustCompile(`kNativePluginApiVersion\[\]\s*=\s*"([^"]+)"`)

func readJSONFile(t *testing.T, path string, value any) {
	t.Helper()
	contents, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(contents, value); err != nil {
		t.Fatalf("Failed to parse %s: %v", path, err)
	}
}

func compareLoaderVersions(t *testing.T, left, right string) int {
	t.Helper()
	order, err := compareSemanticVersions(left, right)
	if err != nil {
		t.Fatal(err)
	}
	return order
}

func TestNativeBridgeAPIBumpsTheLoaderAndTheClientMinimum(t *testing.T) {
	root := loaderRoot(t)
	repo := filepath.Join(root, "..", "..")

	header, err := os.ReadFile(filepath.Join(root, "core", "include", "NativePluginVersion.h"))
	if err != nil {
		t.Fatal(err)
	}
	match := nativeBridgeAPIPattern.FindSubmatch(header)
	if match == nil {
		t.Fatal("NativePluginVersion.h does not declare kNativePluginApiVersion")
	}
	released, err := loaderVersion(root)
	if err != nil {
		t.Fatal(err)
	}
	if api := string(match[1]); api != nativeBridgeAPI {
		t.Fatalf("kNativePluginApiVersion is %s but nativeBridgeAPI is %s: set nativeBridgeAPI to %s and nativeBridgeAPILoader to the next loader release, newer than %s", api, nativeBridgeAPI, api, released)
	}

	var client struct {
		Unbound struct {
			MinLoaderVersion string `json:"minLoaderVersion"`
		} `json:"unbound"`
	}
	readJSONFile(t, filepath.Join(repo, "packages", "client", "package.json"), &client)
	if compareLoaderVersions(t, client.Unbound.MinLoaderVersion, nativeBridgeAPILoader) < 0 {
		t.Fatalf("packages/client/package.json unbound.minLoaderVersion is %s, older than loader %s, the first with native bridge API %s", client.Unbound.MinLoaderVersion, nativeBridgeAPILoader, nativeBridgeAPI)
	}

	if compareLoaderVersions(t, nativeBridgeAPILoader, released) <= 0 {
		return
	}
	// Unreleased: Release Please must cut that version, or the client asks for a loader that never ships.
	var config struct {
		Packages map[string]struct {
			ReleaseAs string `json:"release-as"`
		} `json:"packages"`
	}
	readJSONFile(t, filepath.Join(repo, "release-please-loader-config.json"), &config)
	if releaseAs := config.Packages["packages/loader"].ReleaseAs; releaseAs != nativeBridgeAPILoader {
		t.Fatalf("loader %s, the first with native bridge API %s, is unreleased (version.json is %s); set release-as to %s in release-please-loader-config.json, not %q", nativeBridgeAPILoader, nativeBridgeAPI, released, nativeBridgeAPILoader, releaseAs)
	}
}
