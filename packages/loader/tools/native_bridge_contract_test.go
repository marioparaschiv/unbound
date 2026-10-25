package main

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestNativeBridgeContractIsSynchronized(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	header, err := os.ReadFile(filepath.Join(root, "core", "include", "NativePluginVersion.h"))
	if err != nil {
		t.Fatal(err)
	}
	source, err := os.ReadFile(filepath.Join(root, "ios", "sources", "NativePluginBridge.mm"))
	if err != nil {
		t.Fatal(err)
	}
	types, err := os.ReadFile(filepath.Join(root, "core", "src", "NativeTypeEncoding.cpp"))
	if err != nil {
		t.Fatal(err)
	}
	headerText := string(header)
	sourceText := string(source)
	typeText := string(types)
	if !strings.Contains(headerText, `kNativePluginApiVersion[] = "1.0.0"`) {
		t.Fatal("native plugin API version is not v1")
	}
	if !strings.Contains(headerText, `kNativePluginAbiVersion[] = "1.0.0"`) {
		t.Fatal("native plugin ABI version is not v1")
	}
	if !strings.Contains(sourceText, "loader::native::NativePluginRootBuilder bridge(runtime, loader::native::NativePluginPlatform::IOS);") {
		t.Fatal("the iOS bridge does not advertise the shared iOS capability list")
	}
	if !strings.Contains(sourceText, "loader::native::onRuntimeGenerationChanged(invalidateRuntimeResources);") {
		t.Fatal("the iOS bridge does not release hooks and surfaces when the runtime is replaced")
	}
	for _, symbol := range []string{
		"ffi_closure_alloc",
		"ffi_prep_closure_loc",
		"dispatchFFIHook",
		"dispatchVoidHook",
		"dispatchObjectObjectHook",
		"dispatchBoolObjectObjectHook",
		"dispatchObjectCGRectHook",
		"dispatchCGSizeNoArgumentHook",
		"dispatchVoidObjectHook",
		"dispatchVoidNSUIntegerHook",
		"dispatchVoidObjectObjectHook",
		"replaceObjectArgument",
		"instanceTarget",
		"isExecutableAddress",
		"invokeHookOriginal",
		"setHookSizeHeightFloor",
		"applyHookSizeHeightFloors",
		"setSizeHeightFloor",
		"loader::ffi::callInterface(signature->result, signature->arguments)",
		"&dispatcher->signature->interface->cif",
		"valueToData",
		"structResult",
		"objc_setAssociatedObject",
		"BigInt::fromInt64",
		"BigInt::fromUint64",
	} {
		if !strings.Contains(sourceText, symbol) {
			t.Fatalf("native hook symbol %q is missing from the loader", symbol)
		}
	}
	if !strings.Contains(sourceText, "Native hook closure is unavailable on this device") {
		t.Fatal("native hook closure fail-closed diagnostic is missing from the loader")
	}
	if !strings.Contains(sourceText, `signature.arguments[2].name == "u64"`) {
		t.Fatal("native unsigned 64-bit argument hooks do not have a precompiled fallback")
	}
	if !strings.Contains(sourceText, "class NativeDataBuffer") ||
		!strings.Contains(sourceText, "[value isKindOfClass:[NSData class]]") {
		t.Fatal("native Objective-C data results are not converted to JavaScript byte arrays")
	}
	if !strings.Contains(sourceText, "static Value objcHandleResult(Runtime &runtime, id value)") ||
		!strings.Contains(sourceText, "return objcHandleResult(rt, [[cls alloc] init]);") {
		t.Fatal("native Objective-C allocation does not always return a native handle")
	}
	dataHandler := strings.Index(sourceText, `objc.setProperty(runtime, "data", makeFunction(`)
	if dataHandler < 0 {
		t.Fatal("native Objective-C data constructor is missing")
	}
	dataHandlerEnd := strings.Index(sourceText[dataHandler:], `objc.setProperty(runtime, "hook",`)
	if dataHandlerEnd < 0 ||
		!strings.Contains(sourceText[dataHandler:dataHandler+dataHandlerEnd], "return objcHandleResult(rt, data);") {
		t.Fatal("native Objective-C data constructor does not return an NSData handle")
	}
	if !strings.Contains(sourceText, "NATIVE_BRIDGE_ERROR") ||
		!strings.Contains(sourceText, "return loader::native::makeFunction(runtime, name, argCount, std::move(translated));") {
		t.Fatal("native bridge exceptions are missing structured error codes")
	}
	rawFunctionHandler := strings.Index(sourceText, "Value (*handler)(Runtime &, const Value *, size_t)")
	if rawFunctionHandler < 0 ||
		!strings.Contains(sourceText[rawFunctionHandler:], "return makeFunction(name, argCount, runtime, wrappedHandler);") {
		t.Fatal("raw native bridge handlers bypass structured error wrapping")
	}
	if !strings.Contains(sourceText, `signature.result.name == "object" && signature.arguments.size() == 3`) {
		t.Fatal("native object-return hooks do not have a precompiled fallback")
	}
	if !strings.Contains(sourceText, `signature.result.name == "bool" || signature.result.name == "i8"`) ||
		!strings.Contains(sourceText, `signature.arguments.size() == 4`) {
		t.Fatal("native boolean hooks with two object arguments do not have a precompiled fallback")
	}
	if !strings.Contains(sourceText, `signature.arguments[2].name == "struct:CGRect"`) {
		t.Fatal("native object-return CGRect hooks do not have a precompiled fallback")
	}
	if !strings.Contains(typeText, `fields == "{CGPoint=dd}{CGSize=dd}"`) ||
		!strings.Contains(typeText, `fields == "dd"`) {
		t.Fatal("native type parsing must validate CGRect and CGPoint field layouts")
	}
	if !strings.Contains(sourceText, `signature.result.name != "struct:CGSize"`) ||
		!strings.Contains(sourceText, `signature.arguments.size() == 2`) {
		t.Fatal("native no-argument CGSize hooks do not have a precompiled fallback")
	}
	if !strings.Contains(sourceText, "Native hook original() cannot cross runtime threads") {
		t.Fatal("native hook original thread safety diagnostic is missing from the loader")
	}
	if strings.Contains(sourceText, "originalRequested") {
		t.Fatal("native hook original invocation still uses deferred return semantics")
	}
	if !strings.Contains(sourceText, "state->instanceTarget == object") {
		t.Fatal("native hook instance targets are not filtered before JavaScript dispatch")
	}
	if !strings.Contains(sourceText, "method_getImplementation(method) == dispatcher->original") {
		t.Fatal("native hook dispatchers are not restored when their original IMP is current")
	}
	if strings.Contains(sourceText, "method_setImplementation") {
		t.Fatal("native hook dispatchers bypass the shared hook framework")
	}
	if !strings.Contains(sourceText, "MSHookMessageEx(cls, selector, (IMP) dispatcher->code, &dispatcher->original)") {
		t.Fatal("native hook dispatchers are not installed through the shared hook framework")
	}
	if !strings.Contains(sourceText, "MSHookMessageEx(dispatcher->cls, dispatcher->selector,") {
		t.Fatal("native hook dispatchers are not restored through the shared hook framework")
	}
	if !strings.Contains(sourceText, "current == (IMP) dispatcher->code || current == dispatcher->original") {
		t.Fatal("native hook dispatchers are not retained while external IMPs may chain through them")
	}
	registration := strings.Index(sourceText, "dispatcher = iterator->second;")
	if registration < 0 {
		t.Fatal("native hook registration branch is missing")
	}
	registrationEnd := strings.Index(sourceText[registration:], "auto state = std::make_shared<HookState>();")
	if registrationEnd < 0 {
		t.Fatal("native hook registration branch is missing")
	}
	if strings.Contains(sourceText[registration:registration+registrationEnd], "dispatcher->original = method_getImplementation(method)") {
		t.Fatal("native hook registration can wrap an external IMP that already chains through its dispatcher")
	}
	ffiCall, err := os.ReadFile(filepath.Join(root, "core", "src", "ffi", "NativeFFICall.cpp"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(ffiCall), "class CallInterfaceCache") ||
		!strings.Contains(string(ffiCall), "entries_.size() > kCallInterfaceCacheCapacity") {
		t.Fatal("native FFI call interface cache is missing or unbounded")
	}
	for _, shared := range []string{
		`makeFunction("symbol", 2, runtime, loader::ffi::lookupSymbol)`,
		`makeFunction("call", 3, runtime, loader::ffi::callFunction)`,
		"using loader::ffi::PointerHost;",
		`loader::ffi::registerExtensionType("object"`,
		`loader::ffi::registerExtensionType("class"`,
		`loader::ffi::registerExtensionType("selector"`,
		"loader::ffi::setPointerResolver(",
		"loader::ffi::setStructResultFactory(",
	} {
		if !strings.Contains(sourceText, shared) {
			t.Fatalf("the iOS bridge does not use the shared core FFI through %q", shared)
		}
	}
	for _, duplicate := range []string{"class PointerHost", "ffi_prep_cif(", "static Value ffiResult(", "NativePluginFFI.h"} {
		if strings.Contains(sourceText, duplicate) {
			t.Fatalf("the iOS bridge still carries its own FFI implementation (%q)", duplicate)
		}
	}
	for _, installation := range []string{
		`bridge.addNamespace("debug", std::move(debug));`,
		`loader::native::makeRecordEvaluationFunction(runtime)`,
		`makeFunction("environment", 0, runtime, environment)`,
	} {
		if !strings.Contains(sourceText, installation) {
			t.Fatalf("native debug function %q is not installed on the bridge", installation)
		}
	}
	evaluations, err := os.ReadFile(filepath.Join(root, "core", "src", "NativeEvaluations.cpp"))
	if err != nil {
		t.Fatal(err)
	}
	recordFunction := strings.Index(string(evaluations), "jsi::Function makeRecordEvaluationFunction(")
	if recordFunction < 0 ||
		!strings.Contains(string(evaluations)[recordFunction:], "catch (...)") ||
		!strings.Contains(string(evaluations)[recordFunction:], "return jsi::Value(false);") {
		t.Fatal("native evaluation records can throw into JavaScript on bad input")
	}
}

func TestAndroidNativeBridgeContractIsSynchronized(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	source, err := os.ReadFile(filepath.Join(root, "android", "module", "src", "main", "cpp", "NativePluginBridge.cpp"))
	if err != nil {
		t.Fatal(err)
	}
	sourceText := string(source)
	for _, contract := range []string{
		"loader::native::NativePluginRootBuilder bridge(runtime, loader::native::NativePluginPlatform::Android);",
		`define(runtime, ui, "lookup",`,
		`define(runtime, ui, "snapshot",`,
		`define(runtime, ui, "measure",`,
		`define(runtime, ui, "setFrame",`,
		`define(runtime, ui, "mount",`,
		`define(runtime, ui, "update",`,
		`define(runtime, ui, "unmount",`,
		`define(runtime, java, "getClass",`,
		`define(runtime, java, "className",`,
		`define(runtime, java, "construct",`,
		`define(runtime, java, "respondsTo",`,
		`define(runtime, java, "invoke",`,
		`define(runtime, java, "invokeAsync",`,
		`define(runtime, java, "getField",`,
		`define(runtime, java, "setField",`,
		`define(runtime, java, "release",`,
		`define(runtime, java, "batch",`,
		`define(runtime, java, "createAssociationKey",`,
		`define(runtime, java, "getAssociatedObject",`,
		`define(runtime, java, "setAssociatedObject",`,
		`bridge.addNamespace("java"`,
		`bridge.addNamespace("hooks"`,
		`define(runtime, hooks, "hook",`,
		`define(runtime, hooks, "remove",`,
		`define(runtime, hooks, "setReturnValue",`,
		`define(runtime, hooks, "removeReturnValue",`,
		`define(runtime, hooks, "clearReturnValues",`,
		"dispatchHookEvent(",
		`"recordEvaluation"`,
		`define(runtime, debug, "environment",`,
		`bridge.addNamespace("debug"`,
		`bridge.addNamespace("fabric"`,
		`define(runtime, fabric, "mountAsync",`,
		`define(runtime, fabric, "updateAsync",`,
		`define(runtime, fabric, "setSizeAsync",`,
		`define(runtime, fabric, "setFrameAsync",`,
		`define(runtime, fabric, "measureAsync",`,
		`define(runtime, fabric, "unmountAsync",`,
		"loader::native::onRuntimeGenerationChanged(",
		"retireHookListeners();",
		"applyHookLimits(callbacks);",
		"executeMainAsynchronously(",
		"bridge.install();",
	} {
		if !strings.Contains(sourceText, contract) {
			t.Fatalf("Android native bridge contract %q is missing", contract)
		}
	}
	for _, unsupported := range []string{
		"native.objc.",
		"__nativeFailure",
		`bridge.addNamespace("surfaces"`,
	} {
		if strings.Contains(sourceText, unsupported) {
			t.Fatalf("Android native bridge must not advertise platform-specific capability %q", unsupported)
		}
	}
}

func TestNativeBridgeSafetyGuards(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	bridge, err := os.ReadFile(filepath.Join(root, "ios", "sources", "NativePluginBridge.mm"))
	if err != nil {
		t.Fatal(err)
	}
	loader, err := os.ReadFile(filepath.Join(root, "ios", "sources", "Unbound.xm"))
	if err != nil {
		t.Fatal(err)
	}
	filesystem, err := os.ReadFile(filepath.Join(root, "ios", "sources", "FileSystem.m"))
	if err != nil {
		t.Fatal(err)
	}
	updater, err := os.ReadFile(filepath.Join(root, "core", "src", "LoaderUpdater.cpp"))
	if err != nil {
		t.Fatal(err)
	}
	coreFFI, err := os.ReadFile(filepath.Join(root, "core", "src", "ffi", "NativeFFI.cpp"))
	if err != nil {
		t.Fatal(err)
	}
	addressValidation, err := os.ReadFile(filepath.Join(root, "core", "src", "NativeAddressValidation.cpp"))
	if err != nil {
		t.Fatal(err)
	}
	for _, required := range []string{
		"ffi.call requires an executable symbol pointer",
		"!isCallableSymbolAddress(host->value())",
	} {
		if !strings.Contains(string(coreFFI), required) {
			t.Fatalf("shared FFI safety guard %q is missing", required)
		}
	}
	for _, required := range []string{
		"bool isCallableSymbolAddress(void *address)",
		"return isExecutableAddress(address) && isInstructionSectionAddress(address);",
		"vm_region_recurse_64",
		"S_ATTR_PURE_INSTRUCTIONS | S_ATTR_SOME_INSTRUCTIONS",
		"dl_iterate_phdr(findExecutableSegment, &search)",
	} {
		if !strings.Contains(string(addressValidation), required) {
			t.Fatalf("shared callable address guard %q is missing", required)
		}
	}
	for _, required := range []string{
		"Native value exceeds conversion limits",
		"dispatcher->closure && isExecutableAddress(dispatcher->code)",
		"if (code == ':')",
		"[invocation retainArguments]",
		"Native super invocation cannot synchronously cross to the main thread",
		`"invokeSuperAsync"`,
		`"mountAsync"`,
		`"updateAsync"`,
		`"setSizeAsync"`,
		`"setFrameAsync"`,
		`"measureAsync"`,
		`"unmountAsync"`,
		"NATIVE_WRONG_THREAD",
		"static Value invokeBatch(Runtime &runtime, const Value *args, size_t count)",
		"Native batch requires at most 64 steps",
		"Native batch can only reference earlier results",
		"Native batch method return type is unsupported",
		"Native batch method argument type is unsupported",
		"Native scalar argument is out of range",
		"Native batch object argument cannot be a pointer",
		"Native batch struct argument has the wrong layout",
		"executeMainAsynchronously(",
	} {
		if !strings.Contains(string(bridge), required) {
			t.Fatalf("native bridge safety guard %q is missing", required)
		}
	}
	runtimeSource, err := os.ReadFile(filepath.Join(root, "core", "src", "NativePluginRuntime.cpp"))
	if err != nil {
		t.Fatal(err)
	}
	for _, required := range []string{
		"Native async invocation was cancelled",
		"__NativePluginPendingInvocations",
		"gate.expire()",
		"gMainThreadRuntimeWaits.fetch_add(1)",
		"NATIVE_MAIN_THREAD_TIMEOUT",
	} {
		if !strings.Contains(string(runtimeSource), required) {
			t.Fatalf("native runtime safety guard %q is missing", required)
		}
	}
	if !strings.Contains(string(bridge), "loader::native::setExecutor(std::make_shared<IOSNativePluginExecutor>());") {
		t.Fatal("the iOS bridge does not run on the shared native runtime executor")
	}
	if strings.Contains(string(bridge), "result = invokeObject(runtime, target, selector, arguments)") {
		t.Fatal("Objective-C invocation still creates JSI values on the main thread")
	}
	for _, required := range []string{"[HotReload observe];", "pipeline().prepare()", "pipeline().enqueueBundle()"} {
		if !strings.Contains(string(loader), required) {
			t.Fatalf("loader lifecycle guard %q is missing", required)
		}
	}
	corePipeline, err := os.ReadFile(filepath.Join(root, "core", "src", "LoaderPipeline.cpp"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(corePipeline), "Bundle preparation timed out.") {
		t.Fatal("the shared loader pipeline no longer bounds bundle preparation")
	}
	if strings.Contains(string(bridge), "dispatch_sync(dispatch_get_main_queue()") {
		t.Fatal("native bridge still uses an unbounded synchronous main-thread dispatch")
	}
	superStart := strings.Index(string(bridge), "static void setSuperFFIArgument(")
	superEnd := strings.Index(string(bridge), "static Value invokeSuperObject(")
	if superStart < 0 || superEnd <= superStart ||
		!strings.Contains(string(bridge)[superStart:superEnd], "validateNativeScalarArgument(object, scalarType);") {
		t.Fatal("Objective-C super arguments bypass scalar validation")
	}
	for _, required := range []string{"updater_.markBundleAttempted(pending->path)", "updater_.acceptBundle(pending->path)", "updater_.rejectBundle(pending->path)"} {
		if !strings.Contains(string(corePipeline), required) {
			t.Fatalf("bundle promotion step %q is missing", required)
		}
	}
	for _, required := range []string{".candidate", "Downloaded bundle candidate is unavailable", "promoteNativeBundle(path.c_str()", "restoreNativeBundle(backup.c_str()", ".attempting", ".promoting"} {
		if !strings.Contains(string(updater), required) {
			t.Fatalf("transactional bundle step %q is missing", required)
		}
	}
	for _, required := range []string{"DownloadTimedOut", "DownloadWriteFailed"} {
		if !strings.Contains(string(filesystem), required) {
			t.Fatalf("bundle download guard %q is missing", required)
		}
	}
}
