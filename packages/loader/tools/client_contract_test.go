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

type capabilityBinding struct {
	capability string
	namespace  string
	methods    []string
}

func coreCapabilityBindings(t *testing.T, header string) map[string]capabilityBinding {
	t.Helper()
	arrays := map[string][]string{}
	for _, match := range regexp.MustCompile(`(?s)std::array<std::string_view,\s*\d+>\s+(k\w+Methods)\s*=\s*\{(.*?)\};`).FindAllStringSubmatch(header, -1) {
		arrays[match[1]] = regexp.MustCompile(`"([^"]+)"`).FindAllString(match[2], -1)
		for index, method := range arrays[match[1]] {
			arrays[match[1]][index] = strings.Trim(method, `"`)
		}
	}
	bindings := map[string]capabilityBinding{}
	for _, match := range regexp.MustCompile(`\{"(native\.[a-zA-Z]+\.[a-zA-Z]+)",\s*"(\w+)",\s*(k\w+Methods)\}`).FindAllStringSubmatch(header, -1) {
		methods, ok := arrays[match[3]]
		if !ok {
			t.Fatalf("capability %s references the undeclared method list %s", match[1], match[3])
		}
		bindings[match[1]] = capabilityBinding{capability: match[1], namespace: match[2], methods: methods}
	}
	if len(bindings) == 0 {
		t.Fatal("core declares no capability bindings")
	}
	return bindings
}

func installedBridgeMethods(source string, patterns ...*regexp.Regexp) map[string]map[string]bool {
	installed := map[string]map[string]bool{}
	for _, pattern := range patterns {
		for _, match := range pattern.FindAllStringSubmatch(source, -1) {
			if installed[match[1]] == nil {
				installed[match[1]] = map[string]bool{}
			}
			installed[match[1]][match[2]] = true
		}
	}
	return installed
}

func coreFabricMethods(fabric string, platform string) map[string]bool {
	methods := map[string]bool{}
	synchronous := strings.Contains(platform, "FabricCalls::SyncAndAsync")
	for _, match := range regexp.MustCompile(`fabric\.define\("(\w+)"`).FindAllStringSubmatch(fabric, -1) {
		methods[match[1]+"Async"] = true
		if synchronous {
			methods[match[1]] = true
		}
	}
	for _, match := range regexp.MustCompile(`fabric\.defineAsync\("(\w+)"`).FindAllStringSubmatch(fabric, -1) {
		methods[match[1]] = true
	}
	return methods
}

func withCoreFabric(installed map[string]map[string]bool, fabric string, platform string) map[string]map[string]bool {
	if strings.Contains(platform, "makeFabricNamespace(") {
		installed["fabric"] = coreFabricMethods(fabric, platform)
	}
	return installed
}

func TestPlatformBridgesInstallEveryAdvertisedCapabilityMethod(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	header, err := os.ReadFile(filepath.Join(root, "core", "include", "NativeCapabilityTable.h"))
	if err != nil {
		t.Fatal(err)
	}
	bindings := coreCapabilityBindings(t, string(header))
	ios := iosNativeBridgeSource(t, root)
	android, err := os.ReadFile(filepath.Join(root, "android", "module", "src", "main", "cpp", "NativePluginBridge.cpp"))
	if err != nil {
		t.Fatal(err)
	}
	fabric, err := os.ReadFile(filepath.Join(root, "core", "src", "NativeFabric.cpp"))
	if err != nil {
		t.Fatal(err)
	}
	pluginRoot, err := os.ReadFile(filepath.Join(root, "core", "src", "NativePluginRoot.cpp"))
	if err != nil {
		t.Fatal(err)
	}
	factory := regexp.MustCompile(`kUIScopeFactory = "(\w+)"`).FindStringSubmatch(string(pluginRoot))
	if factory == nil {
		t.Fatal("core no longer names the UI scope factory it exempts from capability binding")
	}
	setProperty := regexp.MustCompile(`\b(objc|ffi|fabric|debug)\.setProperty\(\s*runtime,\s*"(\w+)"`)
	defined := regexp.MustCompile(`define\(\s*runtime,\s*(\w+),\s*"(\w+)"`)
	platforms := map[string]map[string]map[string]bool{
		"kIOSNativePluginCapabilities":     withCoreFabric(installedBridgeMethods(ios, setProperty), string(fabric), ios),
		"kAndroidNativePluginCapabilities": withCoreFabric(installedBridgeMethods(string(android), defined, setProperty), string(fabric), string(android)),
	}
	for list, installed := range platforms {
		declared := regexp.MustCompile(`(?s)` + list + `\s*=\s*\{(.*?)\};`).FindStringSubmatch(string(header))
		if declared == nil {
			t.Fatalf("core declares no %s list", list)
		}
		for _, capability := range capabilitySet(declared[1]) {
			binding, ok := bindings[capability]
			if !ok {
				t.Fatalf("%s advertises %s, which has no namespace binding", list, capability)
			}
			for _, method := range binding.methods {
				if !installed[binding.namespace][method] {
					t.Fatalf("%s advertises %s but the bridge does not install %s.%s", list, capability, binding.namespace, method)
				}
			}
		}
		for namespace, methods := range installed {
			for method := range methods {
				bound := method == factory[1]
				for _, binding := range bindings {
					if binding.namespace != namespace {
						continue
					}
					for _, candidate := range binding.methods {
						bound = bound || candidate == method
					}
				}
				if !bound {
					t.Fatalf("%s installs %s.%s, which no capability binds", list, namespace, method)
				}
			}
		}
	}
}
