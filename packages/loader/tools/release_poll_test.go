package main

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func TestDiscoverStableCandidateSelectsLatestSharedAndroidVersion(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/lookup":
			if request.URL.Query().Get("bundleId") != defaultBundleID || request.URL.Query().Get("country") != "us" {
				t.Fatalf("unexpected iTunes Lookup query: %s", request.URL.RawQuery)
			}
			fmt.Fprint(writer, `{"resultCount":1,"results":[{"bundleId":"com.hammerandchisel.discord","trackId":985746746,"version":"350.9"}]}`)
		case "/tracker/index":
			fmt.Fprint(writer, `{"latest":{"stable":350008}}`)
		case "/tracker/download/350008/base":
			if request.Header.Get("Range") != "bytes=0-0" {
				t.Fatalf("expected a ranged package availability check, got %q", request.Header.Get("Range"))
			}
			writer.WriteHeader(http.StatusPartialContent)
			fmt.Fprint(writer, "x")
		default:
			t.Fatalf("unexpected request path %q", request.URL.Path)
		}
	}))
	defer server.Close()

	config := releasePollConfig{
		channel:           "stable",
		bundleID:          defaultBundleID,
		itunesLookupURL:   server.URL + "/lookup",
		androidTrackerURL: server.URL + "/tracker",
		httpClient:        server.Client(),
	}
	candidate, err := discoverReleaseCandidate(context.Background(), config)
	if err != nil {
		t.Fatal(err)
	}
	version := candidate.Version
	if version != "350.8" {
		t.Fatalf("selected version %q, want 350.8", version)
	}
}

func TestDiscoverStableCandidateSelectsLatestSharedVersionWhenAndroidIsAhead(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/lookup":
			fmt.Fprint(writer, `{"resultCount":1,"results":[{"bundleId":"com.hammerandchisel.discord","trackId":985746746,"version":"350.8"}]}`)
		case "/tracker/index":
			fmt.Fprint(writer, `{"latest":{"stable":"350009"}}`)
		case "/tracker/download/350008/base":
			writer.WriteHeader(http.StatusPartialContent)
			fmt.Fprint(writer, "x")
		default:
			t.Fatalf("unexpected request path %q", request.URL.Path)
		}
	}))
	defer server.Close()

	config := releasePollConfig{
		channel:           "stable",
		bundleID:          defaultBundleID,
		itunesLookupURL:   server.URL + "/lookup",
		androidTrackerURL: server.URL + "/tracker",
		httpClient:        server.Client(),
	}
	candidate, err := discoverReleaseCandidate(context.Background(), config)
	if err != nil {
		t.Fatal(err)
	}
	version := candidate.Version
	if version != "350.8" {
		t.Fatalf("selected version %q, want 350.8", version)
	}
}

func TestDiscoverStableCandidateSkipsUnavailableMatchingAndroidVersion(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/lookup":
			fmt.Fprint(writer, `{"resultCount":1,"results":[{"bundleId":"com.hammerandchisel.discord","trackId":985746746,"version":"350.8"}]}`)
		case "/tracker/index":
			fmt.Fprint(writer, `{"latest":{"stable":350008}}`)
		case "/tracker/download/350008/base":
			writer.WriteHeader(http.StatusNotFound)
		default:
			t.Fatalf("unexpected request path %q", request.URL.Path)
		}
	}))
	defer server.Close()

	config := releasePollConfig{
		channel:           "stable",
		bundleID:          defaultBundleID,
		itunesLookupURL:   server.URL + "/lookup",
		androidTrackerURL: server.URL + "/tracker",
		httpClient:        server.Client(),
	}
	candidate, err := discoverReleaseCandidate(context.Background(), config)
	if err != nil {
		t.Fatal(err)
	}
	version := candidate.Version
	if version != "" {
		t.Fatalf("selected version %q, want no candidate", version)
	}
}

func TestDiscoverTestflightCandidateSelectsNewestUnexpiredBuild(t *testing.T) {
	now := time.Now().UTC()
	activeExpiry := now.Add(time.Hour).Format(time.RFC3339)
	expiredExpiry := now.Add(-time.Hour).Format(time.RFC3339)
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if strings.HasPrefix(request.URL.Path, "/v1/") && request.Header.Get("Authorization") != "Bearer test-key" {
			t.Fatalf("missing dkrypt authorization header")
		}
		switch request.URL.Path {
		case "/lookup":
			fmt.Fprint(writer, `{"resultCount":1,"results":[{"bundleId":"com.hammerandchisel.discord","trackId":985746746,"version":"350.8"}]}`)
		case "/v1/testflight/985746746/trains":
			fmt.Fprint(writer, `{"trains":[{"trainVersion":"350.8"},{"trainVersion":"351.0"}]}`)
		case "/v1/testflight/985746746/builds":
			switch request.URL.Query().Get("trainVersion") {
			case "350.8":
				fmt.Fprintf(writer, `{"builds":[{"id":10,"bundleId":"%s","cfBundleShortVersion":"350.8","cfBundleVersion":"100","expiration":"%s"}]}`, defaultBundleID, activeExpiry)
			case "351.0":
				fmt.Fprintf(writer, `{"builds":[{"id":11,"bundleId":"%s","cfBundleShortVersion":"351.0","cfBundleVersion":"101","expiration":"%s"},{"id":12,"bundleId":"%s","cfBundleShortVersion":"351.0","cfBundleVersion":"102","expiration":"%s"}]}`, defaultBundleID, expiredExpiry, defaultBundleID, activeExpiry)
			default:
				t.Fatalf("unexpected train version %q", request.URL.Query().Get("trainVersion"))
			}
		default:
			t.Fatalf("unexpected request path %q", request.URL.Path)
		}
	}))
	defer server.Close()

	config := releasePollConfig{
		channel:         "testflight",
		bundleID:        defaultBundleID,
		itunesLookupURL: server.URL + "/lookup",
		dkryptBaseURL:   server.URL,
		dkryptAPIKey:    "test-key",
		httpClient:      server.Client(),
		now:             func() time.Time { return now },
	}
	candidate, err := discoverReleaseCandidate(context.Background(), config)
	if err != nil {
		t.Fatal(err)
	}
	version := candidate.Version
	if version != "351.0_102" {
		t.Fatalf("selected version %q, want 351.0_102", version)
	}
}

func TestDiscoverTestflightCandidateRequiresTestflightScopeKey(t *testing.T) {
	config := releasePollConfig{dkryptAPIKey: ""}
	if _, err := discoverTestflightCandidate(context.Background(), config, 985746746); err == nil || !strings.Contains(err.Error(), "DKRYPT_API_KEY") {
		t.Fatalf("expected missing API key error, got %v", err)
	}
}

func TestGithubReleaseExistsHandlesFoundAndMissingTags(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Authorization") != "Bearer github-token" {
			t.Fatalf("missing GitHub authorization header")
		}
		if strings.HasSuffix(request.URL.Path, "/v1.0_12") {
			writer.WriteHeader(http.StatusOK)
			return
		}
		writer.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	for _, test := range []struct {
		tag    string
		exists bool
	}{{tag: "v1.0_12", exists: true}, {tag: "v1.0_13", exists: false}} {
		exists, err := githubReleaseExists(context.Background(), server.Client(), server.URL, "owner/repo", test.tag, "github-token")
		if err != nil {
			t.Fatal(err)
		}
		if exists != test.exists {
			t.Fatalf("release %s exists=%t, want %t", test.tag, exists, test.exists)
		}
	}
}

func TestWriteReleaseCandidateOutput(t *testing.T) {
	path := t.TempDir() + "/output"
	if err := os.WriteFile(path, []byte("previous=value\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := writeReleaseCandidateOutput(path, releaseCandidate{Version: "350.8_102"}); err != nil {
		t.Fatal(err)
	}
	contents, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(contents) != "previous=value\nversion=350.8_102\n" {
		t.Fatalf("unexpected output contents %q", contents)
	}
}

func TestDiscoverAndroidChannelCandidateTagsTheChannelBuild(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/sniff/v1/details/com.discord/stable", "/sniff/v1/details/com.discord/beta":
			fmt.Fprint(writer, `{"success":true,"data":{"item":{"details":{"app_details":{"version_code":350008}}}}}`)
		case "/sniff/v1/download/com.discord/beta/351112":
			fmt.Fprint(writer, `{"success":true,"data":{"main_apk_url":"https://play.example/base","splits":[]}}`)
		case "/tracker/index":
			fmt.Fprint(writer, `{"latest":{"alpha":352208,"beta":351112,"stable":350008}}`)
		default:
			t.Fatalf("unexpected request path %q", request.URL.Path)
		}
	}))
	defer server.Close()

	config := releasePollConfig{
		channel:           "android-beta",
		androidTrackerURL: server.URL + "/tracker",
		sniffURL:          server.URL + "/sniff",
		httpClient:        server.Client(),
	}
	candidate, err := discoverReleaseCandidate(context.Background(), config)
	if err != nil {
		t.Fatal(err)
	}
	if candidate != (releaseCandidate{Version: "351.12-android-beta", AndroidCode: 351112}) {
		t.Fatalf("selected %+v, want 351.12-android-beta at 351112", candidate)
	}
}

func TestDiscoverAndroidChannelCandidateSkipsUndownloadableBuilds(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch {
		case strings.HasPrefix(request.URL.Path, "/sniff/"):
			writer.WriteHeader(http.StatusInternalServerError)
			fmt.Fprint(writer, `{"success":false,"data":null,"error":"InvalidApp"}`)
		case request.URL.Path == "/tracker/index":
			fmt.Fprint(writer, `{"latest":{"alpha":352208,"beta":351112,"stable":350008}}`)
		case request.URL.Path == "/tracker/download/352208/base":
			writer.WriteHeader(http.StatusNotFound)
		default:
			t.Fatalf("unexpected request path %q", request.URL.Path)
		}
	}))
	defer server.Close()

	config := releasePollConfig{
		channel:           "android-alpha",
		androidTrackerURL: server.URL + "/tracker",
		sniffURL:          server.URL + "/sniff",
		httpClient:        server.Client(),
	}
	candidate, err := discoverReleaseCandidate(context.Background(), config)
	if err != nil {
		t.Fatal(err)
	}
	if candidate != (releaseCandidate{}) {
		t.Fatalf("selected %+v for a build nobody serves", candidate)
	}
}

func TestWriteReleaseCandidateOutputIncludesTheAndroidCode(t *testing.T) {
	path := t.TempDir() + "/output"
	if err := os.WriteFile(path, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := writeReleaseCandidateOutput(path, releaseCandidate{Version: "352.8-android-alpha", AndroidCode: 352208}); err != nil {
		t.Fatal(err)
	}
	contents, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(contents) != "version=352.8-android-alpha\nandroid_code=352208\n" {
		t.Fatalf("unexpected output contents %q", contents)
	}
}
