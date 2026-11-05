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

func trackerServer(t *testing.T, available ...int) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		for _, code := range available {
			if request.URL.Path == fmt.Sprintf("/download/%d/base", code) {
				writer.WriteHeader(http.StatusPartialContent)
				fmt.Fprint(writer, "x")
				return
			}
		}
		writer.WriteHeader(http.StatusNotFound)
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
	{"tag_name":"discord-353.10-android-beta","draft":false},
	{"tag_name":"discord-354.0-android-alpha","draft":false},
	{"tag_name":"discord-353.5-android-alpha","draft":false},
	{"tag_name":"discord-352.9-android","draft":false},
	{"tag_name":"discord-353.0_119349-ios-testflight","draft":false}
]`

func TestLatestReleasedAndroidVersionTakesEachChannelsNewestPublishedDiscord(t *testing.T) {
	server := releasesServer(t, releasedAndroidFixture)
	for channel, want := range map[string]releasedAndroidVersion{"stable": {352, 17}, "beta": {353, 10}, "alpha": {354, 0}} {
		version, err := latestReleasedAndroidVersion(context.Background(), server.Client(), server.URL, "owner/repo", "github-token", channel)
		if err != nil {
			t.Fatal(err)
		}
		if version != want {
			t.Fatalf("%s released %+v, want %+v", channel, version, want)
		}
	}
}

func TestLatestReleasedAndroidVersionReadsEveryPage(t *testing.T) {
	full := "[" + strings.TrimSuffix(strings.Repeat(`{"tag_name":"discord-351.1-android-beta"},`, 100), ",") + "]"
	server := releasesServer(t, full, `[{"tag_name":"discord-352.3-android-beta"}]`)
	version, err := latestReleasedAndroidVersion(context.Background(), server.Client(), server.URL, "owner/repo", "github-token", "beta")
	if err != nil {
		t.Fatal(err)
	}
	if version != (releasedAndroidVersion{352, 3}) {
		t.Fatalf("beta released %+v, want 352.3 from the second page", version)
	}
}

func TestLatestReleasedAndroidVersionFailsWithoutARelease(t *testing.T) {
	server := releasesServer(t, `[{"tag_name":"discord-352.1-ios"}]`)
	if _, err := latestReleasedAndroidVersion(context.Background(), server.Client(), server.URL, "owner/repo", "github-token", "stable"); err == nil || !strings.Contains(err.Error(), "no published Android stable release") {
		t.Fatalf("expected a missing release error, got %v", err)
	}
}

func TestReleasedAndroidCodeTakesTheHighestTrackTheTrackerServes(t *testing.T) {
	for _, test := range []struct {
		channel   string
		version   releasedAndroidVersion
		available []int
		want      int
	}{
		{"stable", releasedAndroidVersion{352, 17}, nil, 352017},
		{"beta", releasedAndroidVersion{353, 7}, []int{353107, 353007}, 353107},
		{"alpha", releasedAndroidVersion{354, 0}, []int{354200}, 354200},
		{"alpha", releasedAndroidVersion{353, 9}, []int{353109}, 353109},
		{"beta", releasedAndroidVersion{352, 17}, nil, 352017},
	} {
		tracker := trackerServer(t, test.available...)
		code, err := releasedAndroidCode(context.Background(), tracker.Client(), tracker.URL, test.channel, test.version)
		if err != nil {
			t.Fatal(err)
		}
		if code != test.want {
			t.Fatalf("%s %+v resolved to %d, want %d", test.channel, test.version, code, test.want)
		}
	}
}
