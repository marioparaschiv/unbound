package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

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
