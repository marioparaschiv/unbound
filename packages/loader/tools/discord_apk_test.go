package main

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDiscordAndroidVersionReadsTheTrackFromTheCode(t *testing.T) {
	for _, test := range []struct {
		code    int
		version string
		track   string
	}{
		{code: 350008, version: "350.8", track: "stable"},
		{code: 351112, version: "351.12", track: "beta"},
		{code: 352208, version: "352.8", track: "alpha"},
		{code: 126021, version: "126.21", track: "stable"},
	} {
		version, track, err := discordAndroidVersion(test.code)
		if err != nil {
			t.Fatal(err)
		}
		if version != test.version || track != test.track {
			t.Fatalf("code %d mapped to %s on %s, want %s on %s", test.code, version, track, test.version, test.track)
		}
	}
	for _, code := range []int{0, 999, 350308, 350908} {
		if _, _, err := discordAndroidVersion(code); err == nil {
			t.Fatalf("code %d was accepted", code)
		}
	}
}

func TestDiscordAndroidReleaseVersionsStayDistinctPerChannel(t *testing.T) {
	for channel, want := range map[string]string{
		"stable": "351.12",
		"beta":   "351.12-android-beta",
		"alpha":  "351.12-android-alpha",
	} {
		if got := discordAndroidReleaseVersion(channel, "351.12"); got != want {
			t.Fatalf("%s release version is %q, want %q", channel, got, want)
		}
	}
}

type fakeDiscordSources struct {
	sniffCodes   map[string]int
	trackerIndex string
	sniffSplits  map[string]string
	files        map[string][]byte
}

func (fake fakeDiscordSources) serve(t *testing.T) *httptest.Server {
	var server *httptest.Server
	server = httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		path := request.URL.Path
		switch {
		case strings.HasPrefix(path, "/sniff/v1/details/com.discord/"):
			channel := strings.TrimPrefix(path, "/sniff/v1/details/com.discord/")
			code, ok := fake.sniffCodes[channel]
			if !ok {
				writer.WriteHeader(http.StatusInternalServerError)
				fmt.Fprint(writer, `{"success":false,"data":null,"error":"account is not enrolled"}`)
				return
			}
			fmt.Fprintf(writer, `{"success":true,"data":{"item":{"details":{"app_details":{"version_code":%d,"version_string":"ignored"}}}}}`, code)
		case strings.HasPrefix(path, "/sniff/v1/download/com.discord/"):
			if fake.sniffSplits == nil {
				writer.WriteHeader(http.StatusInternalServerError)
				fmt.Fprint(writer, `{"success":false,"data":null,"error":"API error for alpha channel: Error { kind: InvalidApp }"}`)
				return
			}
			var splits []string
			for name, file := range fake.sniffSplits {
				if name != "base" {
					splits = append(splits, fmt.Sprintf(`{"name":%q,"download_url":%q}`, name, server.URL+file))
				}
			}
			fmt.Fprintf(writer, `{"success":true,"data":{"main_apk_url":%q,"splits":[%s],"additional_files":[]}}`, server.URL+fake.sniffSplits["base"], strings.Join(splits, ","))
		case path == "/tracker/index":
			if fake.trackerIndex == "" {
				writer.WriteHeader(http.StatusBadGateway)
				return
			}
			fmt.Fprint(writer, fake.trackerIndex)
		default:
			data, ok := fake.files[path]
			if !ok {
				t.Fatalf("unexpected request path %q", path)
			}
			writer.Write(data)
		}
	}))
	t.Cleanup(server.Close)
	return server
}

func testDiscordSources(server *httptest.Server) discordAPKSources {
	return discordAPKSources{sniffURL: server.URL + "/sniff", trackerURL: server.URL + "/tracker", client: server.Client()}
}

func TestLatestCodeTakesTheNewestBuildAnyEligibleTrackServes(t *testing.T) {
	server := fakeDiscordSources{
		sniffCodes:   map[string]int{"stable": 350008, "beta": 350008},
		trackerIndex: `{"latest":{"alpha":352208,"beta":"351112","stable":350008}}`,
	}.serve(t)
	sources := testDiscordSources(server)
	for channel, want := range map[string]int{"stable": 350008, "beta": 351112, "alpha": 352208} {
		code, err := sources.latestCode(context.Background(), channel)
		if err != nil {
			t.Fatal(err)
		}
		if code != want {
			t.Fatalf("%s resolved to %d, want %d", channel, code, want)
		}
	}
	if _, err := sources.latestCode(context.Background(), "canary"); err == nil {
		t.Fatal("an unknown channel was accepted")
	}
}

func TestLatestCodeServesTheBetaToBetaUsersOnceStableOvertakesIt(t *testing.T) {
	server := fakeDiscordSources{
		sniffCodes:   map[string]int{"stable": 352008},
		trackerIndex: `{"latest":{"alpha":352208,"beta":351112,"stable":350008}}`,
	}.serve(t)
	code, err := testDiscordSources(server).latestCode(context.Background(), "beta")
	if err != nil {
		t.Fatal(err)
	}
	if code != 352008 {
		t.Fatalf("beta resolved to %d, want the newer stable 352008", code)
	}
}

func TestLatestCodeSurvivesOneSourceFailing(t *testing.T) {
	server := fakeDiscordSources{sniffCodes: map[string]int{"stable": 350008, "beta": 351112}}.serve(t)
	code, err := testDiscordSources(server).latestCode(context.Background(), "beta")
	if err != nil {
		t.Fatal(err)
	}
	if code != 351112 {
		t.Fatalf("beta resolved to %d without the tracker, want 351112", code)
	}
	unavailable := fakeDiscordSources{}.serve(t)
	if _, err := testDiscordSources(unavailable).latestCode(context.Background(), "alpha"); err == nil || !strings.Contains(err.Error(), "no source knows") {
		t.Fatalf("expected an error when every source fails, got %v", err)
	}
}

func TestSplitURLsPreferSniffAndFallBackToTheTracker(t *testing.T) {
	sniffed := fakeDiscordSources{sniffSplits: map[string]string{"base": "/play/base", "config.arm64_v8a": "/play/arm64"}}.serve(t)
	urls := testDiscordSources(sniffed).splitURLs(context.Background(), "beta", 351112, []string{"base", "config.arm64_v8a", "config.xxhdpi"})
	for split, want := range map[string]string{
		"base":             sniffed.URL + "/play/base",
		"config.arm64_v8a": sniffed.URL + "/play/arm64",
		"config.xxhdpi":    sniffed.URL + "/tracker/download/351112/config.xxhdpi",
	} {
		if urls[split] != want {
			t.Fatalf("%s resolved to %q, want %q", split, urls[split], want)
		}
	}
	refused := fakeDiscordSources{}.serve(t)
	urls = testDiscordSources(refused).splitURLs(context.Background(), "alpha", 352208, []string{"base"})
	if want := refused.URL + "/tracker/download/352208/base"; urls["base"] != want {
		t.Fatalf("base resolved to %q, want the tracker fallback %q", urls["base"], want)
	}
}

func testAPKBytes(t *testing.T, manifest []byte) []byte {
	t.Helper()
	var archive bytes.Buffer
	writer := zip.NewWriter(&archive)
	entry, err := writer.Create("AndroidManifest.xml")
	if err != nil {
		t.Fatal(err)
	}
	entry.Write(manifest)
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return archive.Bytes()
}

func TestDownloadDiscordSplitVerifiesTheDownloadedBuild(t *testing.T) {
	server := fakeDiscordSources{files: map[string][]byte{
		"/play/base":  testAPKBytes(t, discordTestManifest(352208, "352.8 - Alpha", "")),
		"/play/stale": testAPKBytes(t, discordTestManifest(350008, "350.8 - Stable", "")),
	}}.serve(t)
	directory := t.TempDir()
	manifest, err := downloadDiscordSplit(context.Background(), server.Client(), server.URL+"/play/base", filepath.Join(directory, "base.apk"), 352208)
	if err != nil {
		t.Fatal(err)
	}
	if manifest.VersionName != "352.8 - Alpha" {
		t.Fatalf("downloaded %+v", manifest)
	}
	if _, err := os.Stat(filepath.Join(directory, "base.apk")); err != nil {
		t.Fatal(err)
	}
	if _, err := downloadDiscordSplit(context.Background(), server.Client(), server.URL+"/play/stale", filepath.Join(directory, "stale.apk"), 352208); err == nil {
		t.Fatal("a download with the wrong version code was accepted")
	}
}
