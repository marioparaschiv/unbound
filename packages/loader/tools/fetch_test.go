package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"
)

func TestFetchIPACacheHit(t *testing.T) {
	data := []byte("test ipa bytes")
	digest := sha256.Sum256(data)
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method == http.MethodPost {
			_ = json.NewEncoder(writer).Encode(map[string]any{"status": "done", "cacheHit": true, "channel": "appstore", "resolvedVersion": "342.0", "artifact": map[string]any{"id": "artifact-1", "fileUrl": "/file", "sizeBytes": len(data), "sha256": hex.EncodeToString(digest[:])}})
			return
		}
		_, _ = writer.Write(data)
	}))
	defer server.Close()
	path := filepath.Join(t.TempDir(), "discord.ipa")
	result, err := fetchIPA(server.URL, "com.example.discord", "342", "secret", path, 1)
	if err != nil {
		t.Fatal(err)
	}
	if result["cache_hit"] != "true" || result["version"] != "342.0" {
		t.Fatalf("unexpected result: %#v", result)
	}
	actual, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(actual) != string(data) {
		t.Fatalf("unexpected artifact: %q", actual)
	}
}

func TestFetchIPAQueuedRunningDone(t *testing.T) {
	data := []byte("queued ipa")
	digest := sha256.Sum256(data)
	statuses := []map[string]any{
		{"status": "queued", "statusUrl": "/status"},
		{"status": "running", "progress": "installing", "statusUrl": "/status"},
		{"status": "done", "channel": "testflight", "versionLabel": "342.0_1", "artifact": map[string]any{"fileUrl": "/file", "sizeBytes": len(data), "sha256": hex.EncodeToString(digest[:])}},
	}
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method == http.MethodPost {
			_ = json.NewEncoder(writer).Encode(statuses[0])
			statuses = statuses[1:]
			return
		}
		if request.URL.Path == "/status" {
			_ = json.NewEncoder(writer).Encode(statuses[0])
			statuses = statuses[1:]
			return
		}
		_, _ = writer.Write(data)
	}))
	defer server.Close()
	path := filepath.Join(t.TempDir(), "discord.ipa")
	result, err := fetchIPAWith(server.URL, "com.example.discord", "342", "secret", path, time.Minute, func(time.Duration) {}, time.Now)
	if err != nil {
		t.Fatal(err)
	}
	if result["is_testflight"] != "true" || result["version"] != "342.0_1" {
		t.Fatalf("unexpected result: %#v", result)
	}
}

func TestFetchIPAChecksumMismatchRemovesOutput(t *testing.T) {
	data := []byte("test ipa bytes")
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method == http.MethodPost {
			_ = json.NewEncoder(writer).Encode(map[string]any{"status": "done", "artifact": map[string]any{"fileUrl": "/file", "sizeBytes": len(data), "sha256": "0000000000000000000000000000000000000000000000000000000000000000"}})
			return
		}
		_, _ = writer.Write(data)
	}))
	defer server.Close()
	path := filepath.Join(t.TempDir(), "discord.ipa")
	if _, err := fetchIPA(server.URL, "com.example.discord", "342", "secret", path, 1); err == nil {
		t.Fatal("expected checksum error")
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("output exists after failed download: %v", err)
	}
}

func TestDownloadAndVerifyRetriesInterruptedBody(t *testing.T) {
	data := []byte("complete ipa bytes after retry")
	digest := sha256.Sum256(data)
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requests++
		if requests == 1 {
			writer.Header().Set("Content-Length", strconv.Itoa(len(data)))
			_, _ = writer.Write(data[:len(data)/2])
			return
		}
		_, _ = writer.Write(data)
	}))
	defer server.Close()
	path := filepath.Join(t.TempDir(), "discord.ipa")
	err := downloadAndVerifyWith(
		server.URL,
		"secret",
		path,
		int64(len(data)),
		hex.EncodeToString(digest[:]),
		3,
		func(time.Duration) {},
	)
	if err != nil {
		t.Fatal(err)
	}
	if requests != 2 {
		t.Fatalf("download attempts = %d, want 2", requests)
	}
	actual, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(actual) != string(data) {
		t.Fatalf("downloaded artifact = %q", actual)
	}
}

func TestRequestWithRetriesRetriesInterruptedGetResponse(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		requests++
		if requests == 1 {
			writer.Header().Set("Content-Length", "100")
			_, _ = writer.Write([]byte(`{"status":`))
			return
		}
		_ = json.NewEncoder(writer).Encode(map[string]string{"status": "done"})
	}))
	defer server.Close()

	result, err := requestWithRetriesUsing(
		server.URL,
		"secret",
		http.MethodGet,
		nil,
		requestJSON,
		func(time.Duration) {},
	)
	if err != nil {
		t.Fatal(err)
	}
	if requests != 2 || result["status"] != "done" {
		t.Fatalf("requests = %d, result = %#v", requests, result)
	}
}

func TestRequestWithRetriesDoesNotRetryPostTransportError(t *testing.T) {
	requests := 0
	request := func(string, string, string, map[string]any) (map[string]any, error) {
		requests++
		return nil, &requestTransportError{errors.New("connection reset")}
	}
	_, err := requestWithRetriesUsing(
		"https://example.com",
		"secret",
		http.MethodPost,
		nil,
		request,
		func(time.Duration) {},
	)
	if err == nil || requests != 1 {
		t.Fatalf("requests = %d, error = %v", requests, err)
	}
}

func TestAuthenticatedSourceDownloadSendsAPIKey(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if got := request.Header.Get("Authorization"); got != "Bearer secret" {
			t.Errorf("authorization header = %q", got)
		}
		_, _ = writer.Write([]byte("authenticated ipa"))
	}))
	defer server.Close()

	path := filepath.Join(t.TempDir(), "discord.ipa")
	if err := downloadDirect(server.URL+"/v1/artifacts/artifact/file", "secret", path); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "authenticated ipa" {
		t.Fatalf("downloaded data = %q", data)
	}
}

func TestAuthenticatedSourceDownloadRejectsExternalRedirect(t *testing.T) {
	redirected := false
	external := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		redirected = true
		if got := request.Header.Get("Authorization"); got != "" {
			t.Errorf("authorization header = %q", got)
		}
		writer.WriteHeader(http.StatusOK)
	}))
	defer external.Close()

	source := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		http.Redirect(writer, request, external.URL, http.StatusFound)
	}))
	defer source.Close()

	path := filepath.Join(t.TempDir(), "discord.ipa")
	if err := downloadDirect(source.URL, "secret", path); err == nil {
		t.Fatal("expected external redirect error")
	}
	if redirected {
		t.Fatal("followed redirect to an external host")
	}
}

func TestRunFetchAuthenticatedSource(t *testing.T) {
	t.Setenv("DKRYPT_API_KEY", "secret")
	t.Setenv("GITHUB_OUTPUT", "")
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if got := request.Header.Get("Authorization"); got != "Bearer secret" {
			t.Errorf("authorization header = %q", got)
		}
		_, _ = writer.Write([]byte("authenticated ipa"))
	}))
	defer server.Close()

	path := filepath.Join(t.TempDir(), "discord.ipa")
	err := runFetch([]string{"--base-url", server.URL, "--source-url", server.URL + "/v1/artifacts/artifact/file", "--authenticated-source", "--output", path})
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "authenticated ipa" {
		t.Fatalf("downloaded data = %q", data)
	}
}

func TestExternalSourceDownloadDoesNotSendAPIKey(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if got := request.Header.Get("Authorization"); got != "" {
			t.Errorf("authorization header = %q", got)
		}
		_, _ = writer.Write([]byte("external ipa"))
	}))
	defer server.Close()

	path := filepath.Join(t.TempDir(), "discord.ipa")
	if err := downloadDirect(server.URL, "", path); err != nil {
		t.Fatal(err)
	}
}

func TestRunFetchExternalSourceDoesNotSendAPIKey(t *testing.T) {
	t.Setenv("DKRYPT_API_KEY", "secret")
	t.Setenv("GITHUB_OUTPUT", "")
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if got := request.Header.Get("Authorization"); got != "" {
			t.Errorf("authorization header = %q", got)
		}
		_, _ = writer.Write([]byte("external ipa"))
	}))
	defer server.Close()

	path := filepath.Join(t.TempDir(), "discord.ipa")
	if err := runFetch([]string{"--source-url", server.URL, "--output", path}); err != nil {
		t.Fatal(err)
	}
}

func TestAuthenticatedSourceRequiresCredential(t *testing.T) {
	t.Setenv("DKRYPT_API_KEY", "")
	if _, err := sourceAPIKey("https://ipa.dylib.dev/v1/artifacts/artifact/file", defaultDkryptURL, true); err == nil {
		t.Fatal("expected missing credential error")
	}
}

func TestAuthenticatedSourceUsesConfiguredHost(t *testing.T) {
	t.Setenv("DKRYPT_API_KEY", "secret")
	server := httptest.NewServer(http.NotFoundHandler())
	defer server.Close()

	key, err := sourceAPIKey(server.URL+"/v1/artifacts/artifact/file", server.URL, true)
	if err != nil {
		t.Fatal(err)
	}
	if key != "secret" {
		t.Fatalf("source API key = %q", key)
	}
}

func TestAuthenticatedSourceRejectsExternalHost(t *testing.T) {
	t.Setenv("DKRYPT_API_KEY", "secret")
	if _, err := sourceAPIKey("https://example.com/app.ipa", defaultDkryptURL, true); err == nil {
		t.Fatal("expected external host error")
	}
}
