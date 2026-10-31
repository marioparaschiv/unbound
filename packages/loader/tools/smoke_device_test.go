package main

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func TestMergeDeviceSettingsKeepsTheDevicesOwnSettings(t *testing.T) {
	current := []byte(`{"astral":{"debugger":{"enabled":false,"address":"10.0.0.2:9090"},"loader":{"update":{"url":"http://127.0.0.1:9/"}}},"plugins":{"states":{"user.plugin":true}},"theme":"dark"}`)
	smoke := []byte(`{"astral":{"debugger":{"enabled":true,"address":"192.168.1.5:9092"}},"plugins":{"states":{"astral.moyai":true}}}`)
	merged, err := mergeDeviceSettings(current, smoke)
	if err != nil {
		t.Fatal(err)
	}
	var settings struct {
		Astral struct {
			Debugger map[string]any `json:"debugger"`
			Loader   struct {
				Update struct {
					URL string `json:"url"`
				} `json:"update"`
			} `json:"loader"`
		} `json:"astral"`
		Plugins struct {
			States map[string]bool `json:"states"`
		} `json:"plugins"`
		Theme string `json:"theme"`
	}
	if err := json.Unmarshal(merged, &settings); err != nil {
		t.Fatal(err)
	}
	if settings.Astral.Debugger["address"] != "192.168.1.5:9092" || settings.Astral.Debugger["enabled"] != true {
		t.Fatalf("the smoke debugger must win: %v", settings.Astral.Debugger)
	}
	if settings.Astral.Loader.Update.URL != "http://127.0.0.1:9/" || settings.Theme != "dark" {
		t.Fatalf("the device's own settings must survive: %s", merged)
	}
	if len(settings.Plugins.States) != 1 || !settings.Plugins.States["astral.moyai"] {
		t.Fatalf("only the smoke plugins may be enabled: %v", settings.Plugins.States)
	}
}

func TestParseDeviceRootReadsTheMarker(t *testing.T) {
	if got := parseDeviceRoot("noise\nUBD_ROOT=/var/mobile/Containers/Data/Application/X/Documents/astral\n"); got != "/var/mobile/Containers/Data/Application/X/Documents/astral" {
		t.Fatalf("unexpected root %q", got)
	}
	if parseDeviceRoot("") != "" {
		t.Fatal("no marker means no root")
	}
}

func TestSplitPartsCoversTheArchive(t *testing.T) {
	data := []byte(strings.Repeat("x", 10))
	parts := splitParts(data, 4)
	if len(parts) != 3 || len(parts[2]) != 2 {
		t.Fatalf("unexpected parts %v", parts)
	}
	if len(splitParts([]byte("ab"), 4)) != 1 {
		t.Fatal("a small archive is one part")
	}
}

func TestParsePilotShellReportsFailures(t *testing.T) {
	if output, err := parsePilotShell(`{"exitCode":0,"output":"ok\n"}`); err != nil || output != "ok\n" {
		t.Fatalf("unexpected %q %v", output, err)
	}
	if _, err := parsePilotShell(`{"exitCode":2,"output":"nope"}`); err == nil {
		t.Fatal("a non-zero exit is a failure")
	}
	if _, err := parsePilotShell(`not json`); err == nil {
		t.Fatal("non-JSON output is a failure")
	}
}

func TestSmokeArchiveHoldsSettingsAndPlugins(t *testing.T) {
	directory := t.TempDir()
	if err := os.WriteFile(directory+"/index.js", []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	archive, err := smokeArchive([]smokePlugin{{id: "astral.moyai", directory: directory, files: []string{"index.js"}}}, []byte("{}"))
	if err != nil || len(archive) == 0 {
		t.Fatalf("archive failed: %v", err)
	}
}
