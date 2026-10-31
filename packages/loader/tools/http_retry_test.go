package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func retryingTestClient() *http.Client {
	return &http.Client{
		Timeout:   5 * time.Second,
		Transport: retryingTransport{base: http.DefaultTransport, attempts: lookupAttempts, backoff: time.Millisecond},
	}
}

func TestLookupsRetryAServerErrorOnce(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if calls.Add(1) == 1 {
			writer.WriteHeader(http.StatusBadGateway)
			return
		}
		writer.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	response, err := retryingTestClient().Get(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != http.StatusOK || calls.Load() != 2 {
		t.Fatalf("got %d after %d calls, want 200 after 2", response.StatusCode, calls.Load())
	}
}

func TestLookupsGiveUpAfterTheRetry(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		calls.Add(1)
		writer.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server.Close()

	response, err := retryingTestClient().Get(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != http.StatusServiceUnavailable || calls.Load() != lookupAttempts {
		t.Fatalf("got %d after %d calls, want 503 after %d", response.StatusCode, calls.Load(), lookupAttempts)
	}
}

func TestLookupsNeverRetryPostsOrClientErrors(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		calls.Add(1)
		if request.Method == http.MethodPost {
			writer.WriteHeader(http.StatusBadGateway)
			return
		}
		writer.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	client := retryingTestClient()
	response, err := client.Post(server.URL, "application/json", strings.NewReader("{}"))
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	response, err = client.Get(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if calls.Load() != 2 {
		t.Fatalf("made %d calls, want one POST and one GET", calls.Load())
	}
}
