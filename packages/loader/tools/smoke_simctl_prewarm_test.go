package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestWaitForLogLine(t *testing.T) {
	logs := strings.NewReader("Discord[1] [app.unbound:default] Blocked SentrySDK.\nDiscord[1] [app.unbound:runtime] Discord's runtime was created.\n")
	if !waitForLogLine(context.Background(), logs, smokeRuntimeCreated, time.Second) {
		t.Fatal("the runtime line arrived")
	}
	if waitForLogLine(context.Background(), strings.NewReader("Discord[1] still updating\n"), smokeRuntimeCreated, 50*time.Millisecond) {
		t.Fatal("no runtime line arrived")
	}
}

func TestAppendGitHubOutput(t *testing.T) {
	path := filepath.Join(t.TempDir(), "output")
	if err := os.WriteFile(path, []byte("other=1\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := appendGitHubOutput(path, "device", "UDID"); err != nil {
		t.Fatal(err)
	}
	if data, _ := os.ReadFile(path); string(data) != "other=1\ndevice=UDID\n" {
		t.Fatalf("output file is %q", data)
	}
}
