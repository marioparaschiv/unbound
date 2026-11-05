package main

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func releasesServer(t *testing.T, pages ...string) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/repos/owner/repo/releases" || request.Header.Get("Authorization") != "Bearer github-token" {
			t.Fatalf("unexpected request %s with authorization %q", request.URL, request.Header.Get("Authorization"))
		}
		var page int
		fmt.Sscan(request.URL.Query().Get("page"), &page)
		if page < 1 || page > len(pages) {
			fmt.Fprint(writer, "[]")
			return
		}
		fmt.Fprint(writer, pages[page-1])
	}))
	t.Cleanup(server.Close)
	return server
}

const releasedAndroidFixture = `[
	{"tag_name":"discord-352.17-android","draft":false},
	{"tag_name":"discord-352.1-ios","draft":false},
	{"tag_name":"discord-353.0-android","draft":true},
	{"tag_name":"loader-latest","draft":false},
	{"tag_name":"discord-353.7-android-beta","draft":false},
	{"tag_name":"discord-354.0-android-alpha","draft":false},
	{"tag_name":"discord-353.5-android-alpha","draft":false},
	{"tag_name":"discord-352.9-android","draft":false},
	{"tag_name":"discord-353.0_119349-ios-testflight","draft":false}
]`

func TestLatestReleasedAndroidCodeTakesEachChannelsNewestPublishedDiscord(t *testing.T) {
	server := releasesServer(t, releasedAndroidFixture)
	for channel, want := range map[string]int{"stable": 352017, "beta": 353007, "alpha": 354000} {
		code, err := latestReleasedAndroidCode(context.Background(), server.Client(), server.URL, "owner/repo", "github-token", channel)
		if err != nil {
			t.Fatal(err)
		}
		if code != want {
			t.Fatalf("%s released %d, want %d", channel, code, want)
		}
	}
}

func TestLatestReleasedAndroidCodeReadsEveryPage(t *testing.T) {
	full := "[" + strings.TrimSuffix(strings.Repeat(`{"tag_name":"discord-351.1-android-beta"},`, 100), ",") + "]"
	server := releasesServer(t, full, `[{"tag_name":"discord-352.3-android-beta"}]`)
	code, err := latestReleasedAndroidCode(context.Background(), server.Client(), server.URL, "owner/repo", "github-token", "beta")
	if err != nil {
		t.Fatal(err)
	}
	if code != 352003 {
		t.Fatalf("beta released %d, want 352003 from the second page", code)
	}
}

func TestLatestReleasedAndroidCodeFailsWithoutARelease(t *testing.T) {
	server := releasesServer(t, `[{"tag_name":"discord-352.1-ios"}]`)
	if _, err := latestReleasedAndroidCode(context.Background(), server.Client(), server.URL, "owner/repo", "github-token", "stable"); err == nil || !strings.Contains(err.Error(), "no published Android stable release") {
		t.Fatalf("expected a missing release error, got %v", err)
	}
}
