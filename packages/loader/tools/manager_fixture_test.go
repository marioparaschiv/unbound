package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"testing"
)

func writeFixtureFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func startManagerFixture(t *testing.T, root string) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(newManagerFixture(root, "http://10.0.2.2:8790", io.Discard).handler())
	t.Cleanup(server.Close)
	return server
}

func getFixture(t *testing.T, url string, headers map[string]string) (*http.Response, []byte) {
	t.Helper()
	request, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		t.Fatal(err)
	}
	for key, value := range headers {
		request.Header.Set(key, value)
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatal(err)
	}
	return response, body
}

func fixtureTags(t *testing.T, body []byte) []string {
	t.Helper()
	var releases []map[string]any
	if err := json.Unmarshal(body, &releases); err != nil {
		t.Fatal(err)
	}
	tags := []string{}
	for _, release := range releases {
		tags = append(tags, release["tag_name"].(string))
	}
	return tags
}

func TestManagerFixtureReleasesMatchGitHubShape(t *testing.T) {
	root := t.TempDir()
	tag := "loader-v353.0-android-alpha"
	writeFixtureFile(t, filepath.Join(root, tag, "Unbound-alpha.apks"), "apks payload")
	writeFixtureFile(t, filepath.Join(root, tag, "release.json"), `{"name": "Alpha 353", "body": "## Notes", "published_at": "2026-05-01T10:00:00+02:00"}`)
	server := startManagerFixture(t, root)

	response, body := getFixture(t, server.URL+"/releases?per_page=100", nil)
	if response.StatusCode != http.StatusOK || response.Header.Get("Content-Type") != "application/json" {
		t.Fatalf("unexpected response %d %q", response.StatusCode, response.Header.Get("Content-Type"))
	}
	var releases []map[string]any
	if err := json.Unmarshal(body, &releases); err != nil {
		t.Fatal(err)
	}
	if len(releases) != 1 {
		t.Fatalf("expected one release, got %s", body)
	}
	release := releases[0]
	keys := []string{}
	for key := range release {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	if want := []string{"assets", "body", "draft", "name", "prerelease", "published_at", "tag_name"}; !reflect.DeepEqual(keys, want) {
		t.Fatalf("release fields %v, want %v", keys, want)
	}
	if release["tag_name"] != tag || release["name"] != "Alpha 353" || release["draft"] != false ||
		release["prerelease"] != true || release["body"] != "## Notes" || release["published_at"] != "2026-05-01T08:00:00Z" {
		t.Fatalf("unexpected release metadata: %#v", release)
	}
	assets := release["assets"].([]any)
	if len(assets) != 1 {
		t.Fatalf("release.json must not be an asset: %#v", assets)
	}
	asset := assets[0].(map[string]any)
	keys = keys[:0]
	for key := range asset {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	if want := []string{"browser_download_url", "digest", "name", "size", "updated_at"}; !reflect.DeepEqual(keys, want) {
		t.Fatalf("asset fields %v, want %v", keys, want)
	}
	sum := sha256.Sum256([]byte("apks payload"))
	if asset["name"] != "Unbound-alpha.apks" || asset["size"] != float64(len("apks payload")) ||
		asset["browser_download_url"] != "http://10.0.2.2:8790/download/"+tag+"/Unbound-alpha.apks" ||
		asset["digest"] != "sha256:"+hex.EncodeToString(sum[:]) {
		t.Fatalf("unexpected asset: %#v", asset)
	}
}

func TestManagerFixtureDefaultsAndNewestFirst(t *testing.T) {
	root := t.TempDir()
	writeFixtureFile(t, filepath.Join(root, "loader-v352.0-android-alpha", "release.json"), `{"published_at": "2026-04-01T00:00:00Z"}`)
	writeFixtureFile(t, filepath.Join(root, "loader-v354.0", "release.json"), `{"published_at": "2026-06-01T00:00:00Z"}`)
	writeFixtureFile(t, filepath.Join(root, "loader-v353.0-android-alpha", "release.json"), `{"published_at": "2026-05-01T00:00:00Z"}`)
	server := startManagerFixture(t, root)

	_, body := getFixture(t, server.URL+"/releases", nil)
	if got, want := fixtureTags(t, body), []string{"loader-v354.0", "loader-v353.0-android-alpha", "loader-v352.0-android-alpha"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("order %v, want %v", got, want)
	}
	var releases []fixtureRelease
	if err := json.Unmarshal(body, &releases); err != nil {
		t.Fatal(err)
	}
	if releases[0].Name != "loader-v354.0" || releases[0].Prerelease || releases[0].Body != "Fixture release loader-v354.0" || !releases[1].Prerelease {
		t.Fatalf("unexpected defaults: %#v", releases)
	}
}

func TestManagerFixtureETagAndRescan(t *testing.T) {
	root := t.TempDir()
	writeFixtureFile(t, filepath.Join(root, "loader-v353.0-android-alpha", "app.unbound.android.lsposed.apk"), "module")
	server := startManagerFixture(t, root)

	first, _ := getFixture(t, server.URL+"/releases", nil)
	etag := first.Header.Get("ETag")
	if etag == "" {
		t.Fatal("expected an ETag")
	}
	cached, body := getFixture(t, server.URL+"/releases", map[string]string{"If-None-Match": etag})
	if cached.StatusCode != http.StatusNotModified || len(body) != 0 {
		t.Fatalf("expected 304 with no body, got %d %q", cached.StatusCode, body)
	}

	writeFixtureFile(t, filepath.Join(root, "loader-v354.0-android-alpha", "release.json"), `{"published_at": "2099-01-01T00:00:00Z"}`)
	changed, body := getFixture(t, server.URL+"/releases", map[string]string{"If-None-Match": etag})
	if changed.StatusCode != http.StatusOK || changed.Header.Get("ETag") == etag {
		t.Fatalf("expected a fresh 200 after a new tag, got %d", changed.StatusCode)
	}
	if got := fixtureTags(t, body); len(got) != 2 || got[0] != "loader-v354.0-android-alpha" {
		t.Fatalf("new tag did not appear first: %v", got)
	}
}

func TestManagerFixtureDownloadSupportsRange(t *testing.T) {
	root := t.TempDir()
	writeFixtureFile(t, filepath.Join(root, "loader-v353.0-android-alpha", "Unbound-alpha.apks"), "0123456789")
	server := startManagerFixture(t, root)

	full, body := getFixture(t, server.URL+"/download/loader-v353.0-android-alpha/Unbound-alpha.apks", nil)
	if full.StatusCode != http.StatusOK || string(body) != "0123456789" {
		t.Fatalf("unexpected download %d %q", full.StatusCode, body)
	}
	partial, body := getFixture(t, server.URL+"/download/loader-v353.0-android-alpha/Unbound-alpha.apks", map[string]string{"Range": "bytes=4-"})
	if partial.StatusCode != http.StatusPartialContent || string(body) != "456789" || partial.Header.Get("Content-Range") != "bytes 4-9/10" {
		t.Fatalf("unexpected range response %d %q %q", partial.StatusCode, body, partial.Header.Get("Content-Range"))
	}
	missing, _ := getFixture(t, server.URL+"/download/loader-v353.0-android-alpha/release.json", nil)
	if missing.StatusCode != http.StatusNotFound {
		t.Fatalf("release.json must not be downloadable, got %d", missing.StatusCode)
	}
}
