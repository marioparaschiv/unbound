package main

import (
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"testing"
)

func loaderRoot(t *testing.T) string {
	t.Helper()
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	return filepath.Dir(filepath.Dir(filename))
}

func TestNativeFailureGuardRethrowsEnvelopesInJavaScript(t *testing.T) {
	root := loaderRoot(t)
	header, err := os.ReadFile(filepath.Join(root, "core", "include", "NativePluginRuntime.h"))
	if err != nil {
		t.Fatal(err)
	}
	match := regexp.MustCompile(`(?s)kNativeFailureGuardSource = R"JS\((.*?)\)JS";`).FindStringSubmatch(string(header))
	if match == nil {
		t.Fatal("core declares no native failure guard source")
	}
	engine := ""
	for _, candidate := range []string{"bun", "node"} {
		if path, err := exec.LookPath(candidate); err == nil {
			engine = path
			break
		}
	}
	if engine == "" {
		t.Skip("no JavaScript engine is available")
	}
	script := "const guard = " + match[1] + `;
const check = (condition, message) => { if (!condition) throw new Error(message); };
const failing = guard(function () { return { __unboundNativeFailure: { code: 'NATIVE_TEST', message: 'boom' } }; });
let caught;
try { failing(); } catch (error) { caught = error; }
check(caught instanceof Error, 'an envelope must throw an Error');
check(caught.message === 'boom', 'the native message must be kept');
check(caught.code === 'NATIVE_TEST', 'the native code must be kept');
const forwarding = guard(function (first, second) { return [this.tag, first, second]; });
check(JSON.stringify(forwarding.call({ tag: 'receiver' }, 1, 2)) === '["receiver",1,2]', 'receiver and arguments must be forwarded');
check(guard(function () { return { value: 1 }; })().value === 1, 'plain objects must pass through');
var hostLike = new Proxy({}, { getOwnPropertyDescriptor: function () { return { value: undefined, configurable: true, enumerable: true }; }, get: function () { return undefined; } });
check(guard(function () { return hostLike; })() === hostLike, 'objects that only claim the failure key must pass through');
check(guard(function () { return null; })() === null, 'null must pass through');
check(guard(function () { return undefined; })() === undefined, 'undefined must pass through');
check(globalThis.__unboundGuardNativeFunction === guard, 'the guard must be cached on the global');
`
	command := exec.Command(engine, "-e", script)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("native failure guard misbehaves: %v\n%s", err, output)
	}
}

func TestHostFunctionsOnlyComeFromTheGuardedFactory(t *testing.T) {
	root := loaderRoot(t)
	allowed := filepath.Join(root, "core", "src", "NativePluginRuntime.cpp")
	directories := []string{
		filepath.Join(root, "core", "src"),
		filepath.Join(root, "core", "include"),
		filepath.Join(root, "android", "module", "src", "main", "cpp"),
	}
	hostObjectAccessor := regexp.MustCompile(`(?s)class \w+[^{;]*:\s*public\s+(facebook::)?jsi::HostObject\s*\{(.*?)\n\s*\};`)
	accessor := regexp.MustCompile(`\b(get|set|getPropertyNames)\s*\(\s*(facebook::)?jsi::Runtime`)
	for _, directory := range directories {
		err := filepath.WalkDir(directory, func(path string, entry fs.DirEntry, err error) error {
			if err != nil || entry.IsDir() {
				return err
			}
			if !strings.HasSuffix(path, ".cpp") && !strings.HasSuffix(path, ".h") {
				return nil
			}
			source, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			text := string(source)
			if path != allowed && strings.Contains(text, "createFromHostFunction") {
				t.Errorf("%s creates a host function outside loader::native::makeFunction", path)
			}
			for _, match := range hostObjectAccessor.FindAllStringSubmatch(text, -1) {
				if accessor.MatchString(match[2]) {
					t.Errorf("%s declares a host object accessor that can throw into Hermes", path)
				}
			}
			return nil
		})
		if err != nil {
			t.Fatal(err)
		}
	}
	runtimeSource, err := os.ReadFile(allowed)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Count(string(runtimeSource), "createFromHostFunction") != 1 ||
		!strings.Contains(string(runtimeSource), "return guard(rt, [&]() { return handler(rt, thisValue, args, count); });") {
		t.Fatal("the core host function factory no longer guards every handler")
	}
	if !strings.Contains(string(runtimeSource), "static std::atomic<NativeErrorDelivery> gErrorDelivery{NativeErrorDelivery::Envelope};") {
		t.Fatal("Android no longer delivers native failures through envelopes")
	}
}
