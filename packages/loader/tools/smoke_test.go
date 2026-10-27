package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func writeSmokePlugin(t *testing.T, root, folder, manifest string, files ...string) {
	t.Helper()
	dist := filepath.Join(root, folder, "dist")
	if err := os.MkdirAll(dist, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dist, "manifest.json"), []byte(manifest), 0o644); err != nil {
		t.Fatal(err)
	}
	for _, file := range files {
		if err := os.WriteFile(filepath.Join(dist, file), []byte("module.exports = {};"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
}

func TestDiscoverSmokePluginsKeepsThePlatformsBuiltPlugins(t *testing.T) {
	root := t.TempDir()
	writeSmokePlugin(t, root, "view-raw", `{"id":"unbound.view-raw","main":"index.js"}`, "index.js")
	writeSmokePlugin(t, root, "moyai", `{"id":"unbound.moyai","main":"index.js","platforms":["ios","android"]}`, "index.js")
	writeSmokePlugin(t, root, "ios-only", `{"id":"unbound.ios-only","main":"index.js","platforms":["ios"]}`, "index.js")
	if err := os.MkdirAll(filepath.Join(root, "shared", "src"), 0o755); err != nil {
		t.Fatal(err)
	}
	plugins, err := discoverSmokePlugins(root, "android")
	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	for _, plugin := range plugins {
		ids = append(ids, plugin.id)
		if !reflect.DeepEqual(plugin.files, []string{"index.js", "manifest.json"}) {
			t.Fatalf("%s must copy its built files, got %v", plugin.id, plugin.files)
		}
	}
	if !reflect.DeepEqual(ids, []string{"unbound.moyai", "unbound.view-raw"}) {
		t.Fatalf("unexpected Android plugins %v", ids)
	}
}

func TestDiscoverSmokePluginsRejectsUnbuiltPlugins(t *testing.T) {
	root := t.TempDir()
	writeSmokePlugin(t, root, "view-raw", `{"id":"unbound.view-raw","main":"index.js"}`)
	if _, err := discoverSmokePlugins(root, "ios"); err == nil || !strings.Contains(err.Error(), "not built") {
		t.Fatalf("a plugin without its bundle must be rejected, got %v", err)
	}
	if _, err := discoverSmokePlugins(t.TempDir(), "ios"); err == nil {
		t.Fatal("a directory without built plugins must be rejected")
	}
	writeSmokePlugin(t, root, "unsafe", `{"id":"../escape","main":"index.js"}`, "index.js")
	if _, err := discoverSmokePlugins(root, "ios"); err == nil || !strings.Contains(err.Error(), "unusable plugin id") {
		t.Fatalf("an id that is not a folder name must be rejected, got %v", err)
	}
}

func TestSmokeSettingsEnableEveryPluginAndTheDebugger(t *testing.T) {
	data, err := smokeSettings([]smokePlugin{{id: "unbound.moyai"}, {id: "unbound.view-raw"}}, "10.0.2.2:9090", "http://10.0.2.2:3000/")
	if err != nil {
		t.Fatal(err)
	}
	var settings map[string]any
	if err := json.Unmarshal(data, &settings); err != nil {
		t.Fatal(err)
	}
	expected := map[string]any{
		"unbound": map[string]any{
			"debugger": map[string]any{"enabled": true, "address": "10.0.2.2:9090"},
			"loader":   map[string]any{"update": map[string]any{"url": "http://10.0.2.2:3000/"}},
		},
		"plugins": map[string]any{"states": map[string]any{"unbound.moyai": true, "unbound.view-raw": true}},
	}
	if !reflect.DeepEqual(settings, expected) {
		t.Fatalf("unexpected settings %s", data)
	}
	data, err = smokeSettings(nil, "127.0.0.1:9090", "")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(data), "loader") {
		t.Fatalf("without a served client the default bundle URL must stay, got %s", data)
	}
}

func TestSmokeLogWatcherReadsLogcat(t *testing.T) {
	watcher := newSmokeLogWatcher(&androidSmokeTarget{})
	for _, line := range []string{
		"10-26 21:00:00.000  4242  4242 I Unbound : [plugins] Loaded unbound.moyai from /data/user/0/com.discord/files/Unbound/Plugins/unbound.moyai/index.js.",
		"10-26 21:00:00.001  4242  4242 I SomeoneElse: Loaded unbound.view-raw from somewhere",
		"10-26 21:00:00.002  4242  4242 I Unbound : [plugins] Loaded 1 plugin.",
		"10-26 21:00:01.000  4242  4300 E ReactNativeJS: [Unbound] [Plugins] Failed to start addon unbound.moyai: TypeError: undefined is not a function",
	} {
		watcher.observe(line)
	}
	plugins := []smokePlugin{{id: "unbound.moyai"}}
	if !watcher.loadedAll(plugins) {
		t.Fatal("the loader line must count as loaded")
	}
	if watcher.loadedAll([]smokePlugin{{id: "unbound.moyai"}, {id: "unbound.view-raw"}}) {
		t.Fatal("only the loader's own log lines count")
	}
	result := &smokeResult{loaded: map[string]bool{}, failures: map[string][]string{}}
	watcher.snapshot(result)
	if result.count != 1 || len(result.failures["unbound.moyai"]) != 1 {
		t.Fatalf("unexpected watcher state %+v", result)
	}
	if watcher.crashed() {
		t.Fatal("no crash was logged")
	}
}

func TestSmokeLogWatcherReadsTheUnifiedLog(t *testing.T) {
	watcher := newSmokeLogWatcher(&iosSmokeTarget{})
	watcher.observe("2026-10-26 21:00:00.000 I  Discord[4242:1a2b] [app.unbound:plugins] Loaded unbound.view-raw from /Users/runner/Library/Developer/CoreSimulator/Devices/X/data/Containers/Data/Application/Y/Documents/Unbound/Plugins/unbound.view-raw/index.js.")
	watcher.observe("2026-10-26 21:00:00.001 I  Discord[4242:1a2b] [app.unbound:plugins] Loaded 1 plugin.")
	if !watcher.loadedAll([]smokePlugin{{id: "unbound.view-raw"}}) {
		t.Fatal("the unified log line must count as loaded")
	}
}

func TestAndroidSmokeRecognisesDiscordCrashes(t *testing.T) {
	target := &androidSmokeTarget{}
	for line, crash := range map[string]bool{
		"10-26 21:00:00.000  4242  4242 E AndroidRuntime: Process: com.discord, PID: 4242":                                             true,
		"10-26 21:00:00.000  4242  4242 F libc    : Fatal signal 11 (SIGSEGV), code 1, tid 4242 (com.discord), pid 4242 (com.discord)": true,
		"10-26 21:00:00.000   600   700 I ActivityManager: Process com.discord (pid 4242) has died: fg  TOP":                           true,
		"10-26 21:00:00.000  1111  1111 F libc    : Fatal signal 6 (SIGABRT), code -1, tid 1111 (other.app), pid 1111 (other.app)":     false,
		"10-26 21:00:00.000  4242  4242 I Unbound : [plugins] Loaded 3 plugins.":                                                       false,
	} {
		if target.isCrashLine(line) != crash {
			t.Errorf("isCrashLine(%q) = %v", line, !crash)
		}
	}
}

func TestParseSmokeEvalOutput(t *testing.T) {
	statuses, err := parseSmokeEvalOutput([]byte(`{"type":"eval-result","id":"1","ok":true,"value":"[{\"id\":\"unbound.moyai\",\"started\":true,\"failed\":false,\"error\":\"\"}]"}`+"\n"), nil)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(statuses, []smokePluginStatus{{ID: "unbound.moyai", Started: true}}) {
		t.Fatalf("unexpected statuses %+v", statuses)
	}
	if _, err := parseSmokeEvalOutput([]byte(`{"type":"eval-result","id":"1","ok":false,"error":"ReferenceError: unbound is not defined"}`), errors.New("exit status 1")); err == nil || !strings.Contains(err.Error(), "unbound is not defined") {
		t.Fatalf("a device-side error must be reported, got %v", err)
	}
	if _, err := parseSmokeEvalOutput([]byte("bridge exploded"), errors.New("exit status 1")); err == nil || !strings.Contains(err.Error(), "bridge exploded") {
		t.Fatalf("unreadable output must be reported, got %v", err)
	}
}

func TestSmokeProblemsRequireEveryPluginLoadedAndStarted(t *testing.T) {
	plugins := []smokePlugin{{id: "unbound.moyai"}, {id: "unbound.view-raw"}, {id: "unbound.translate"}}
	result := &smokeResult{
		plugins:  plugins,
		loaded:   map[string]bool{"unbound.moyai": true, "unbound.view-raw": true},
		count:    2,
		failures: map[string][]string{"unbound.view-raw": {"Failed to start addon unbound.view-raw: boom"}},
		statuses: []smokePluginStatus{
			{ID: "unbound.moyai", Started: true},
			{ID: "unbound.view-raw", Failed: true, Error: "boom"},
		},
	}
	problems := smokeProblems(result)
	for _, expected := range []string{
		"the loader never logged Loaded unbound.translate",
		"the loader reported 2 plugins, expected 3",
		"unbound.view-raw failed to start: Failed to start addon unbound.view-raw: boom",
		"unbound.view-raw is not started: boom",
		"the client does not know unbound.translate",
	} {
		if !strings.Contains(strings.Join(problems, "\n"), expected) {
			t.Errorf("problems are missing %q: %v", expected, problems)
		}
	}
	if strings.Contains(strings.Join(problems, "\n"), "unbound.moyai") {
		t.Fatalf("a started plugin is not a problem: %v", problems)
	}
	result.problems = problems
	report := renderSmokeReport(result)
	for _, expected := range []string{"## ", "| `unbound.moyai` | yes | started |", "| `unbound.translate` | no | unknown to the client |"} {
		if !strings.Contains(report, expected) {
			t.Fatalf("the report is missing %q:\n%s", expected, report)
		}
	}
}

func TestSmokeProblemsPassACleanRun(t *testing.T) {
	plugins := []smokePlugin{{id: "unbound.moyai"}}
	result := &smokeResult{
		platform: "android",
		plugins:  plugins,
		loaded:   map[string]bool{"unbound.moyai": true},
		count:    1,
		failures: map[string][]string{},
		statuses: []smokePluginStatus{{ID: "unbound.moyai", Started: true}},
	}
	if problems := smokeProblems(result); len(problems) != 0 {
		t.Fatalf("a clean run has no problems, got %v", problems)
	}
	if report := renderSmokeReport(result); !strings.Contains(report, "## Android smoke test\n\nDiscord loaded and started all 1 first-party plugins without signing in.") {
		t.Fatalf("unexpected report:\n%s", report)
	}
}

func TestSelectAndroidSplitsPicksTheEmulatorsABI(t *testing.T) {
	directory := t.TempDir()
	for _, name := range []string{"base-487-lspatched.apk", "config.arm64_v8a-487-lspatched.apk", "config.armeabi_v7a-487-lspatched.apk", "config.x86_64-487-lspatched.apk", "config.en-487-lspatched.apk", "config.xxhdpi-487-lspatched.apk"} {
		if err := os.WriteFile(filepath.Join(directory, name), nil, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	splits, err := selectAndroidSplits(directory, "x86_64")
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, split := range splits {
		names = append(names, filepath.Base(split))
	}
	if !reflect.DeepEqual(names, []string{"base-487-lspatched.apk", "config.x86_64-487-lspatched.apk", "config.en-487-lspatched.apk", "config.xxhdpi-487-lspatched.apk"}) {
		t.Fatalf("unexpected splits %v", names)
	}
	if _, err := selectAndroidSplits(directory, "x86"); err == nil {
		t.Fatal("a missing ABI split must be reported")
	}
}

func TestSelectSimulatorPicksTheNewestIOSRuntime(t *testing.T) {
	listing := []byte(`{"runtimes":[
		{"identifier":"com.apple.CoreSimulator.SimRuntime.iOS-17-5","platform":"iOS","version":"17.5","isAvailable":true,"supportedDeviceTypes":[{"identifier":"iPhone-15","productFamily":"iPhone"}]},
		{"identifier":"com.apple.CoreSimulator.SimRuntime.iOS-18-10","platform":"iOS","version":"18.10","isAvailable":true,"supportedDeviceTypes":[{"identifier":"iPad-Pro","productFamily":"iPad"},{"identifier":"iPhone-16e","productFamily":"iPhone"},{"identifier":"iPhone-16-Pro","productFamily":"iPhone"}]},
		{"identifier":"com.apple.CoreSimulator.SimRuntime.iOS-18-9","platform":"iOS","version":"18.9","isAvailable":true,"supportedDeviceTypes":[]},
		{"identifier":"com.apple.CoreSimulator.SimRuntime.iOS-19-0","platform":"iOS","version":"19.0","isAvailable":false,"supportedDeviceTypes":[]},
		{"identifier":"com.apple.CoreSimulator.SimRuntime.watchOS-11-0","platform":"watchOS","version":"11.0","isAvailable":true,"supportedDeviceTypes":[]}
	]}`)
	runtime, deviceType, err := selectSimulator(listing)
	if err != nil {
		t.Fatal(err)
	}
	if runtime != "com.apple.CoreSimulator.SimRuntime.iOS-18-10" || deviceType != "iPhone-16-Pro" {
		t.Fatalf("unexpected simulator %s %s", runtime, deviceType)
	}
	if _, _, err := selectSimulator([]byte(`{"runtimes":[]}`)); err == nil {
		t.Fatal("no runtime must be reported")
	}
}

func TestParseSimctlLaunchPID(t *testing.T) {
	if pid := parseSimctlLaunchPID("com.hammerandchisel.discord: 4242\n"); pid != 4242 {
		t.Fatalf("unexpected pid %d", pid)
	}
	if pid := parseSimctlLaunchPID(""); pid != 0 {
		t.Fatalf("unexpected pid %d", pid)
	}
}

func TestSimulatorProcessListed(t *testing.T) {
	listing := "PID\tStatus\tLabel\n4242\t0\tUIKitApplication:com.hammerandchisel.discord[1a2b][rb-legacy]\n-\t0\tcom.apple.other\n"
	if !simulatorProcessListed(listing, 4242) {
		t.Fatal("a listed pid is running")
	}
	if simulatorProcessListed(listing, 4243) {
		t.Fatal("an unlisted pid is not running")
	}
}
