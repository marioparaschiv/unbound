package main

import (
	"net/http"
	"time"
)

const (
	lookupAttempts = 2
	lookupBackoff  = 2 * time.Second
)

type retryingTransport struct {
	base     http.RoundTripper
	attempts int
	backoff  time.Duration
}

// retryableStatus reports whether a response status is worth retrying: a timeout, too-early, rate limit or server error.
func retryableStatus(status int) bool {
	switch status {
	case http.StatusRequestTimeout, http.StatusTooEarly, http.StatusTooManyRequests:
		return true
	}
	return status >= http.StatusInternalServerError
}

func retryable(response *http.Response, err error) bool {
	if err != nil {
		return true
	}
	return retryableStatus(response.StatusCode)
}

func (transport retryingTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		return transport.base.RoundTrip(request)
	}
	for attempt := 1; ; attempt++ {
		response, err := transport.base.RoundTrip(request.Clone(request.Context()))
		if attempt >= transport.attempts || !retryable(response, err) {
			return response, err
		}
		if response != nil {
			response.Body.Close()
		}
		select {
		case <-request.Context().Done():
			return nil, request.Context().Err()
		case <-time.After(transport.backoff * time.Duration(attempt)):
		}
	}
}

func lookupClient(timeout time.Duration) *http.Client {
	return &http.Client{
		Timeout:   timeout,
		Transport: retryingTransport{base: http.DefaultTransport, attempts: lookupAttempts, backoff: lookupBackoff},
	}
}
