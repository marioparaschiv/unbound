package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLatestDkryptArtifactPicksNewestForChannel(t *testing.T) {
	body := []byte(`{"artifacts":[
		{"id":"old","bundleId":"com.hammerandchisel.discord","channel":"appstore","versionLabel":"300.0","buildNumber":"1","createdAt":"2026-10-01T00:00:00Z","fileUrl":"/f/old","sha256":"aa"},
		{"id":"new","bundleId":"com.hammerandchisel.discord","channel":"appstore","versionLabel":"301.0","buildNumber":"2","createdAt":"2026-10-20T00:00:00Z","fileUrl":"/f/new","sha256":"bb"},
		{"id":"tf","bundleId":"com.hammerandchisel.discord","channel":"testflight","versionLabel":"302.0","buildNumber":"3","createdAt":"2026-10-25T00:00:00Z","fileUrl":"/f/tf","sha256":"cc"},
		{"id":"other","bundleId":"com.example","channel":"appstore","versionLabel":"9","buildNumber":"9","createdAt":"2026-10-26T00:00:00Z","fileUrl":"/f/x","sha256":"dd"}
	]}`)
	artifact, err := latestDkryptArtifact(body, defaultBundleID, "appstore")
	if err != nil || artifact.ID != "new" {
		t.Fatalf("expected the newest App Store build, got %+v %v", artifact, err)
	}
	if _, err := latestDkryptArtifact(body, defaultBundleID, "enterprise"); err == nil {
		t.Fatal("a channel without artifacts should fail")
	}
}

func TestIOSSourceForChannel(t *testing.T) {
	for channel, source := range map[string]string{"stable": "appstore", "beta": "testflight", "alpha": ""} {
		if got := iosSourceForChannel(channel); got != source {
			t.Fatalf("%s maps to %q, want %q", channel, got, source)
		}
	}
}

func TestDkryptFileURLResolvesRelativePaths(t *testing.T) {
	if got := dkryptFileURL("https://ipa.dylib.dev", "/v1/artifacts/a/file"); got != "https://ipa.dylib.dev/v1/artifacts/a/file" {
		t.Fatalf("unexpected URL %q", got)
	}
	if got := dkryptFileURL("https://ipa.dylib.dev", "https://cdn.example/a.ipa"); got != "https://cdn.example/a.ipa" {
		t.Fatalf("absolute URLs should be kept, got %q", got)
	}
}

func TestCachedIOSBuildDownloadsOnceAndVerifies(t *testing.T) {
	payload := []byte("decrypted ipa")
	digest := sha256.Sum256(payload)
	downloads := 0
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Authorization") != "Bearer key" {
			writer.WriteHeader(http.StatusUnauthorized)
			return
		}
		switch request.URL.Path {
		case "/v1/artifacts":
			fmt.Fprintf(writer, `{"artifacts":[{"id":"a","bundleId":%q,"channel":"appstore","versionLabel":"301.0","buildNumber":"77","createdAt":"2026-10-20T00:00:00Z","fileUrl":"/files/a","sha256":%q}]}`, defaultBundleID, hex.EncodeToString(digest[:]))
		case "/files/a":
			downloads++
			writer.Write(payload)
		default:
			writer.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()
	cache := t.TempDir()
	first, err := cachedIOSBuild(context.Background(), server.URL, "key", "appstore", cache)
	if err != nil {
		t.Fatal(err)
	}
	second, err := cachedIOSBuild(context.Background(), server.URL, "key", "appstore", cache)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(cache, "appstore-300.0-1.ipa"), []byte("old"), 0o644); err != nil {
		t.Fatal(err)
	}
	if first != second || downloads != 1 || filepath.Base(first) != "appstore-301.0-77.ipa" {
		t.Fatalf("expected one cached download, got %s %s after %d downloads", first, second, downloads)
	}
	if err := os.WriteFile(first, []byte("tampered"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := cachedIOSBuild(context.Background(), server.URL, "key", "appstore", cache); err != nil || downloads != 2 {
		t.Fatalf("a cached file that no longer matches should be downloaded again, got %v after %d downloads", err, downloads)
	}
	if entries, _ := os.ReadDir(cache); len(entries) != 1 {
		t.Fatalf("older builds should be pruned, cache holds %d entries", len(entries))
	}
}

func TestDefaultCompatCacheHonoursOverride(t *testing.T) {
	t.Setenv("ASTRAL_DISCORD_CACHE", "/tmp/astral-cache-test")
	if got := defaultCompatCache(); got != "/tmp/astral-cache-test" {
		t.Fatalf("unexpected cache %q", got)
	}
}

func TestCompatScanWithoutTargetsExplainsChannel(t *testing.T) {
	err := runCompatScan([]string{})
	if err == nil || !strings.Contains(err.Error(), "--channel <stable|beta|alpha>") {
		t.Fatalf("expected usage mentioning --channel, got %v", err)
	}
}
