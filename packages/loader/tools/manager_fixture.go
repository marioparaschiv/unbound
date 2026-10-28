package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

type fixtureRelease struct {
	TagName     string         `json:"tag_name"`
	Name        string         `json:"name"`
	Draft       bool           `json:"draft"`
	Prerelease  bool           `json:"prerelease"`
	Body        string         `json:"body"`
	PublishedAt string         `json:"published_at"`
	Assets      []fixtureAsset `json:"assets"`
	published   time.Time
}

type fixtureAsset struct {
	Name               string `json:"name"`
	Size               int64  `json:"size"`
	BrowserDownloadURL string `json:"browser_download_url"`
	Digest             string `json:"digest"`
	UpdatedAt          string `json:"updated_at"`
}

type fixtureReleaseOverrides struct {
	Name        *string `json:"name"`
	Prerelease  *bool   `json:"prerelease"`
	Body        *string `json:"body"`
	PublishedAt *string `json:"published_at"`
}

type fixtureDigestKey struct {
	path    string
	size    int64
	modTime time.Time
}

type managerFixture struct {
	root    string
	baseURL string
	log     io.Writer
	mu      sync.Mutex
	digests map[fixtureDigestKey]string
}

func runManagerFixture(args []string) error {
	set := flag.NewFlagSet("manager-fixture", flag.ContinueOnError)
	root := set.String("root", "", "directory with one subdirectory per release tag")
	addr := set.String("addr", "0.0.0.0:8790", "listen address")
	baseURL := set.String("base-url", "http://10.0.2.2:8790", "URL the client reaches this server at")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *root == "" {
		return errors.New("usage: manager-fixture --root <dir> [--addr <host:port>] [--base-url <url>]")
	}
	fixture := newManagerFixture(*root, *baseURL, os.Stderr)
	fmt.Fprintf(os.Stderr, "Serving releases from %s on %s as %s\n", *root, *addr, *baseURL)
	return http.ListenAndServe(*addr, fixture.handler())
}

func newManagerFixture(root, baseURL string, log io.Writer) *managerFixture {
	return &managerFixture{
		root:    root,
		baseURL: strings.TrimSuffix(baseURL, "/"),
		log:     log,
		digests: map[fixtureDigestKey]string{},
	}
}

func (fixture *managerFixture) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /releases", fixture.serveReleases)
	mux.HandleFunc("GET /download/{tag}/{name}", fixture.serveDownload)
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		recorder := &statusRecorder{ResponseWriter: writer, status: http.StatusOK}
		mux.ServeHTTP(recorder, request)
		fmt.Fprintf(fixture.log, "%s %s %s %d\n", time.Now().Format(time.RFC3339), request.Method, request.URL.RequestURI(), recorder.status)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (recorder *statusRecorder) WriteHeader(status int) {
	recorder.status = status
	recorder.ResponseWriter.WriteHeader(status)
}

func (fixture *managerFixture) serveReleases(writer http.ResponseWriter, request *http.Request) {
	releases, err := fixture.scan()
	if err != nil {
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}
	body, err := json.Marshal(releases)
	if err != nil {
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}
	sum := sha256.Sum256(body)
	etag := `"` + hex.EncodeToString(sum[:]) + `"`
	writer.Header().Set("ETag", etag)
	if request.Header.Get("If-None-Match") == etag {
		writer.WriteHeader(http.StatusNotModified)
		return
	}
	writer.Header().Set("Content-Type", "application/json")
	writer.Write(body)
}

func (fixture *managerFixture) serveDownload(writer http.ResponseWriter, request *http.Request) {
	tag, name := request.PathValue("tag"), request.PathValue("name")
	if !fixtureAssetName(tag) || !fixtureAssetName(name) || name == "release.json" {
		http.NotFound(writer, request)
		return
	}
	file, err := os.Open(filepath.Join(fixture.root, tag, name))
	if err != nil {
		http.NotFound(writer, request)
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() {
		http.NotFound(writer, request)
		return
	}
	writer.Header().Set("Content-Type", "application/octet-stream")
	http.ServeContent(writer, request, name, info.ModTime(), file)
}

func fixtureAssetName(name string) bool {
	return name != "" && name != "." && name != ".." && !strings.HasPrefix(name, ".") && !strings.ContainsAny(name, `/\`)
}

func (fixture *managerFixture) scan() ([]fixtureRelease, error) {
	entries, err := os.ReadDir(fixture.root)
	if err != nil {
		return nil, err
	}
	releases := []fixtureRelease{}
	for _, entry := range entries {
		if !entry.IsDir() || !fixtureAssetName(entry.Name()) {
			continue
		}
		release, err := fixture.readRelease(entry.Name())
		if err != nil {
			return nil, fmt.Errorf("read release %s: %w", entry.Name(), err)
		}
		releases = append(releases, release)
	}
	sort.SliceStable(releases, func(i, j int) bool {
		if !releases[i].published.Equal(releases[j].published) {
			return releases[i].published.After(releases[j].published)
		}
		return releases[i].TagName > releases[j].TagName
	})
	return releases, nil
}

func (fixture *managerFixture) readRelease(tag string) (fixtureRelease, error) {
	directory := filepath.Join(fixture.root, tag)
	info, err := os.Stat(directory)
	if err != nil {
		return fixtureRelease{}, err
	}
	release := fixtureRelease{
		TagName:    tag,
		Name:       tag,
		Prerelease: strings.Contains(tag, "-android-"),
		Body:       "Fixture release " + tag,
		published:  info.ModTime(),
		Assets:     []fixtureAsset{},
	}
	if err := applyReleaseOverrides(&release, filepath.Join(directory, "release.json")); err != nil {
		return fixtureRelease{}, err
	}
	release.PublishedAt = release.published.UTC().Format(time.RFC3339)
	entries, err := os.ReadDir(directory)
	if err != nil {
		return fixtureRelease{}, err
	}
	for _, entry := range entries {
		if !entry.Type().IsRegular() || !fixtureAssetName(entry.Name()) || entry.Name() == "release.json" {
			continue
		}
		asset, err := fixture.readAsset(tag, filepath.Join(directory, entry.Name()))
		if err != nil {
			return fixtureRelease{}, err
		}
		release.Assets = append(release.Assets, asset)
	}
	return release, nil
}

func applyReleaseOverrides(release *fixtureRelease, path string) error {
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	var overrides fixtureReleaseOverrides
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&overrides); err != nil {
		return fmt.Errorf("decode %s: %w", path, err)
	}
	if overrides.Name != nil {
		release.Name = *overrides.Name
	}
	if overrides.Prerelease != nil {
		release.Prerelease = *overrides.Prerelease
	}
	if overrides.Body != nil {
		release.Body = *overrides.Body
	}
	if overrides.PublishedAt != nil {
		published, err := time.Parse(time.RFC3339, *overrides.PublishedAt)
		if err != nil {
			return fmt.Errorf("decode %s published_at: %w", path, err)
		}
		release.published = published
	}
	return nil
}

func (fixture *managerFixture) readAsset(tag, path string) (fixtureAsset, error) {
	info, err := os.Stat(path)
	if err != nil {
		return fixtureAsset{}, err
	}
	digest, err := fixture.digest(path, info)
	if err != nil {
		return fixtureAsset{}, err
	}
	return fixtureAsset{
		Name:               info.Name(),
		Size:               info.Size(),
		BrowserDownloadURL: fixture.baseURL + "/download/" + tag + "/" + info.Name(),
		Digest:             "sha256:" + digest,
		UpdatedAt:          info.ModTime().UTC().Format(time.RFC3339),
	}, nil
}

func (fixture *managerFixture) digest(path string, info os.FileInfo) (string, error) {
	key := fixtureDigestKey{path: path, size: info.Size(), modTime: info.ModTime()}
	fixture.mu.Lock()
	cached, found := fixture.digests[key]
	fixture.mu.Unlock()
	if found {
		return cached, nil
	}
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}
	digest := hex.EncodeToString(hash.Sum(nil))
	fixture.mu.Lock()
	fixture.digests[key] = digest
	fixture.mu.Unlock()
	return digest, nil
}
