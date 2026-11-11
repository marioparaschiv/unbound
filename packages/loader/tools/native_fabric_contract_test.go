package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestNativeFabricConformanceIsSharedAcrossPlatforms(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	fixturePath := filepath.Join(root, "core", "tests", "vectors", "native-fabric-conformance.json")
	fixtureBytes, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Module    string `json:"module"`
		Mutations []any  `json:"mutations"`
		Expected  struct {
			UpdateCalls int `json:"updateCalls"`
			SizeCalls   int `json:"sizeCalls"`
			FrameCalls  int `json:"frameCalls"`
		} `json:"expected"`
	}
	if err := json.Unmarshal(fixtureBytes, &fixture); err != nil {
		t.Fatal(err)
	}
	if fixture.Module == "" || len(fixture.Mutations) == 0 || fixture.Expected.UpdateCalls != 1 ||
		fixture.Expected.SizeCalls != 1 || fixture.Expected.FrameCalls != 1 {
		t.Fatal("the shared native Fabric vector must cover a coalesced update, size, and frame")
	}

	files := []string{
		"core/include/NativePluginRuntime.h",
		"core/include/NativeFrameWorkQueue.h",
		"core/src/NativeFrameWorkQueue.cpp",
		"core/src/NativeFabric.cpp",
		"core/tests/hermes/native_fabric_hermes.cpp",
		"ios/sources/NativePluginBridge.mm",
		"ios/sources/NativePluginFabricAdapter.mm",
		"ios/sources/NativePluginFrameScheduler.mm",
		"android/module/src/main/cpp/AndroidLoader.cpp",
		"android/module/src/main/cpp/AndroidLoader.h",
		"android/module/src/main/cpp/NativePluginBridge.cpp",
		"android/module/src/main/kotlin/app/unbound/android/NativeBridge.kt",
		"android/module/src/main/kotlin/app/unbound/android/NativeFabric.kt",
		"android/module/src/test/java/app/unbound/android/NativeFabricTest.kt",
		"../types/typings/native-fabric.ts",
		"../types/typings/native-methods.ts",
	}
	var source strings.Builder
	for _, name := range files {
		path := filepath.Join(root, name)
		contents, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		source.Write(contents)
	}
	contract := source.String()
	for _, required := range []string{
		"runOnMainNextFrame",
		"bool runOnMainNextFrame",
		"Choreographer.getInstance().postFrameCallback",
		"CADisplayLink displayLinkWithTarget",
		"NativeFrameWorkQueue",
		"class AndroidFabricAdapter",
		"makeNativePluginFabricAdapter",
		"Failed to schedule frame-batched native work.",
		"frameQueue_.clear()",
		"fabric.defineAsync(\"batchAsync\"",
		"fabric.batchAsync",
		"native.fabric.async",
		"native-fabric-conformance.json",
	} {
		if !containsCode(contract, required) {
			t.Fatalf("shared native Fabric conformance contract %q is missing", required)
		}
	}
}

func TestNativeFabricFrameBatchesAreAsyncAndNextFrameOnly(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	path := filepath.Join(root, "core", "src", "NativeFabric.cpp")
	source, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	code := string(source)
	if codeIndex(code, `fabric.defineAsync("batchAsync"`) == -1 {
		t.Fatal("Fabric frame batches must be exposed through the asynchronous-only entrypoint")
	}
	if codeIndex(code, `fabric.define("batchAsync"`) != -1 {
		t.Fatal("Fabric frame batches must not acquire a synchronous entrypoint")
	}
	if codeIndex(code, `nullptr, nullptr, true`) == -1 {
		t.Fatal("Fabric frame batches must be scheduled for the next display frame")
	}
}
