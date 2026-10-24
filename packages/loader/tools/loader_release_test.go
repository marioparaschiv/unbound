package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func TestPublishLoaderReleasesSendsBothPlatformRequests(t *testing.T) {
	requests := map[string]loaderReleasePublishRequest{}
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method == http.MethodGet {
			if request.URL.Path != "/api/v1/loader/updates" || request.URL.Query().Get("version") != "0.0.0" {
				t.Fatalf("unexpected latest loader request: %s %s", request.Method, request.URL.String())
			}
			fmt.Fprint(writer, "{\"update\":{\"version\":\"1.0.0\"}}")
			return
		}
		if request.Method != http.MethodPost || request.URL.Path != "/api/v1/loader/releases" {
			t.Fatalf("unexpected loader release request: %s %s", request.Method, request.URL.Path)
		}
		if request.Header.Get("X-API-Key") != "ci-key" {
			t.Fatal("loader release request omitted its API key")
		}
		if request.Header.Get("Content-Type") != "application/json" {
			t.Fatal("loader release request omitted its JSON content type")
		}
		var body loaderReleasePublishRequest
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		requests[body.Platform] = body
		fmt.Fprintf(writer, "{\"platform\":%q,\"version\":%q,\"url\":%q}", body.Platform, body.Version, body.URL)
	}))
	defer server.Close()

	result, err := publishLoaderReleases(context.Background(), loaderReleaseBatchConfig{
		endpoint:   server.URL + "/api/v1/loader/releases",
		apiKey:     "ci-key",
		version:    "1.0.1",
		iosURL:     "https://github.com/unbound-app/loader/releases/download/v352.0/Unbound.deb",
		androidURL: "https://github.com/unbound-app/loader/releases/download/v352.0/Unbound.apk",
		changelog:  "Loader version 1.0.1 adds native bridge validation.",
	})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(result.published, ",") != "ios,android" {
		t.Fatalf("published = %v, want both platforms", result.published)
	}
	for _, platform := range []string{"ios", "android"} {
		body, exists := requests[platform]
		if !exists || body.Version != "1.0.1" {
			t.Fatalf("unexpected %s request: %#v", platform, body)
		}
		if body.Changelog == nil || !strings.Contains(*body.Changelog, "Loader version 1.0.1") {
			t.Fatalf("unexpected %s changelog: %#v", platform, body.Changelog)
		}
	}
}

func TestPublishLoaderReleasesSkipsUnchangedVersions(t *testing.T) {
	postCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method == http.MethodGet {
			fmt.Fprint(writer, "{\"update\":{\"version\":\"1.0.1\"}}")
			return
		}
		postCount++
	}))
	defer server.Close()

	result, err := publishLoaderReleases(context.Background(), loaderReleaseBatchConfig{
		endpoint:   server.URL + "/api/v1/loader/releases",
		apiKey:     "ci-key",
		version:    "1.0.1",
		iosURL:     "https://example.com/Unbound.deb",
		androidURL: "https://example.com/Unbound.apk",
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.published) != 0 || postCount != 0 {
		t.Fatalf("unchanged loader version published: %#v, POST count %d", result.published, postCount)
	}
}

func TestPublishLoaderReleasesReadsChangelogFile(t *testing.T) {
	temporary := t.TempDir()
	changelogPath := temporary + "/changelog.md"
	if err := os.WriteFile(changelogPath, []byte("  Loader version 1.0.1 adds native plugin reliability.\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method == http.MethodGet {
			fmt.Fprint(writer, "{\"update\":null}")
			return
		}
		var body loaderReleasePublishRequest
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body.Changelog == nil || *body.Changelog != "Loader version 1.0.1 adds native plugin reliability." {
			t.Fatalf("unexpected changelog: %#v", body.Changelog)
		}
		fmt.Fprintf(writer, "{\"platform\":%q,\"version\":%q,\"url\":%q}", body.Platform, body.Version, body.URL)
	}))
	defer server.Close()
	t.Setenv("UNBOUND_API_KEY", "ci-key")

	if err := runPublishLoaderReleases([]string{
		"--api-url", server.URL + "/api/v1/loader/releases",
		"--version", "1.0.1",
		"--ios-url", "https://example.com/Unbound.deb",
		"--android-url", "https://example.com/Unbound.apk",
		"--changelog-file", changelogPath,
	}); err != nil {
		t.Fatal(err)
	}
}

func TestPublishLoaderReleasesPreflightsBothPlatforms(t *testing.T) {
	for _, test := range []struct {
		name          string
		version       string
		latest        map[string]string
		wantPublished []string
		wantSkipped   string
	}{
		{
			name:    "stale candidate skips both platforms",
			version: "1.0.2",
			latest: map[string]string{
				"ios":     "1.0.3",
				"android": "1.0.1",
			},
			wantSkipped: "ios",
		},
		{
			name:    "equal platform is skipped while older platform catches up",
			version: "1.0.2",
			latest: map[string]string{
				"ios":     "1.0.2",
				"android": "1.0.1",
			},
			wantPublished: []string{"android"},
		},
		{
			name:    "equal versions skip both platforms",
			version: "1.0.2",
			latest: map[string]string{
				"ios":     "1.0.2",
				"android": "1.0.2",
			},
		},
		{
			name:    "new version is published to both platforms",
			version: "1.0.2",
			latest: map[string]string{
				"ios":     "1.0.1",
				"android": "1.0.1",
			},
			wantPublished: []string{"ios", "android"},
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			getCounts := map[string]int{}
			postCounts := map[string]int{}
			server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				if request.Method == http.MethodGet {
					platform := request.URL.Query().Get("platform")
					getCounts[platform]++
					latest, exists := test.latest[platform]
					if !exists {
						fmt.Fprint(writer, "{\"update\":null}")
						return
					}
					fmt.Fprintf(writer, "{\"update\":{\"version\":%q}}", latest)
					return
				}
				var body loaderReleasePublishRequest
				if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
					t.Fatal(err)
				}
				postCounts[body.Platform]++
				fmt.Fprintf(writer, "{\"platform\":%q,\"version\":%q,\"url\":%q}", body.Platform, test.version, body.URL)
			}))
			defer server.Close()

			result, err := publishLoaderReleases(context.Background(), loaderReleaseBatchConfig{
				endpoint:   server.URL + "/api/v1/loader/releases",
				apiKey:     "ci-key",
				version:    test.version,
				iosURL:     "https://example.com/Unbound.deb",
				androidURL: "https://example.com/Unbound.apk",
				changelog:  "Loader semantic changes.",
			})
			if err != nil {
				t.Fatal(err)
			}
			if result.skippedPlatform != test.wantSkipped {
				t.Fatalf("skipped platform = %q, want %q", result.skippedPlatform, test.wantSkipped)
			}
			if strings.Join(result.published, ",") != strings.Join(test.wantPublished, ",") {
				t.Fatalf("published = %v, want %v", result.published, test.wantPublished)
			}
			for _, platform := range []string{"ios", "android"} {
				if getCounts[platform] != 1 {
					t.Fatalf("%s GET count = %d, want 1", platform, getCounts[platform])
				}
				want := 0
				for _, published := range test.wantPublished {
					if published == platform {
						want = 1
					}
				}
				if postCounts[platform] != want {
					t.Fatalf("%s POST count = %d, want %d", platform, postCounts[platform], want)
				}
			}
		})
	}
}

func TestPublishLoaderReleasesRejectsConfigurationAndAPIErrors(t *testing.T) {
	config := loaderReleaseBatchConfig{
		endpoint:   "https://unbound.rip/api/v1/loader/releases",
		version:    "1.0.1",
		iosURL:     "https://example.com/Unbound.deb",
		androidURL: "https://example.com/Unbound.apk",
	}
	if _, err := publishLoaderReleases(context.Background(), config); err == nil || !strings.Contains(err.Error(), "UNBOUND_API_KEY") {
		t.Fatalf("expected a missing-key error, got %v", err)
	}

	config.apiKey = "ci-key"
	config.endpoint = "ftp://unbound.rip/api/v1/loader/releases"
	if _, err := publishLoaderReleases(context.Background(), config); err == nil || !strings.Contains(err.Error(), "API URL") {
		t.Fatalf("expected invalid API URL error, got %v", err)
	}

	config.endpoint = "https://unbound.rip/api/v1/loader/releases"
	config.iosURL = "file:///loader.deb"
	if _, err := publishLoaderReleases(context.Background(), config); err == nil || !strings.Contains(err.Error(), "iOS loader release asset URL") {
		t.Fatalf("expected invalid iOS asset URL error, got %v", err)
	}

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method == http.MethodGet {
			fmt.Fprint(writer, "{\"update\":null}")
			return
		}
		writer.WriteHeader(http.StatusForbidden)
	}))
	defer server.Close()

	config.endpoint = server.URL + "/api/v1/loader/releases"
	config.iosURL = "https://example.com/Unbound.deb"
	config.androidURL = "https://example.com/Unbound.apk"
	if _, err := publishLoaderReleases(context.Background(), config); err == nil || !strings.Contains(err.Error(), "HTTP 403") {
		t.Fatalf("expected API authorization failure, got %v", err)
	}
}
