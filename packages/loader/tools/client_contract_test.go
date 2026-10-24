package main

import (
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"testing"
)

var quotedCapability = regexp.MustCompile(`["']native\.[a-zA-Z]+\.[a-zA-Z]+["']`)

func capabilitySet(source string) []string {
	seen := map[string]struct{}{}
	for _, match := range quotedCapability.FindAllString(source, -1) {
		seen[strings.Trim(match, `"'`)] = struct{}{}
	}
	result := make([]string, 0, len(seen))
	for capability := range seen {
		result = append(result, capability)
	}
	sort.Strings(result)
	return result
}

func clientPlatformCapabilities(t *testing.T, typings, platform string) []string {
	t.Helper()
	start := strings.Index(typings, "export const NATIVE_PLUGIN_PLATFORM_CAPABILITIES = {")
	if start < 0 {
		t.Fatal("client typings no longer declare NATIVE_PLUGIN_PLATFORM_CAPABILITIES")
	}
	block := typings[start:]
	block = block[:strings.Index(block, "} as const")]
	entry := regexp.MustCompile(`(?s)` + platform + `: \[(.*?)\]`).FindStringSubmatch(block)
	if entry == nil {
		t.Fatalf("client typings declare no %s capabilities", platform)
	}
	return capabilitySet(entry[1])
}

func TestLoaderBridgesAdvertiseTheClientPlatformCapabilities(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	typings, err := os.ReadFile(filepath.Join(root, "..", "types", "typings", "native.ts"))
	if err != nil {
		t.Fatal(err)
	}
	bridges := map[string]string{
		"android": filepath.Join(root, "android", "module", "src", "main", "cpp", "NativePluginBridge.cpp"),
		"ios":     filepath.Join(root, "ios", "sources", "NativePluginBridge.mm"),
	}
	for platform, path := range bridges {
		source, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		loader := capabilitySet(string(source))
		client := clientPlatformCapabilities(t, string(typings), platform)
		if strings.Join(loader, ",") != strings.Join(client, ",") {
			t.Fatalf("%s bridge capabilities %v differ from the client's %v", platform, loader, client)
		}
	}
}
