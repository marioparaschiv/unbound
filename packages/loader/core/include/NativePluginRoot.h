#pragma once

#include <array>
#include <jsi/jsi.h>
#include <map>
#include <set>
#include <span>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace loader::native {
enum class NativePluginPlatform
{
    IOS,
    Android,
};

struct NativeCapabilityBinding {
    std::string_view                  capability;
    std::string_view                  nameSpace;
    std::span<const std::string_view> methods;
};

inline constexpr std::array<std::string_view, 7> kObjCClassMethods = {
    "getClass", "alloc", "className", "respondsTo", "struct", "array", "data",
};
inline constexpr std::array<std::string_view, 4> kObjCInvokeMethods = {
    "call",
    "callSuper",
    "invoke",
    "invokeSuper",
};
inline constexpr std::array<std::string_view, 2> kObjCInvokeAsyncMethods = {
    "invokeAsync",
    "invokeSuperAsync",
};
inline constexpr std::array<std::string_view, 1> kObjCBatchMethods    = {"batch"};
inline constexpr std::array<std::string_view, 2> kObjCSnapshotMethods = {"snapshot", "findViews"};
inline constexpr std::array<std::string_view, 2> kObjCIvarMethods     = {"getIvar", "setIvar"};
inline constexpr std::array<std::string_view, 3> kAssociationMethods  = {
    "createAssociationKey",
    "getAssociatedObject",
    "setAssociatedObject",
};
inline constexpr std::array<std::string_view, 1> kObjCHookMethods    = {"hook"};
inline constexpr std::array<std::string_view, 1> kFFISymbolMethods   = {"symbol"};
inline constexpr std::array<std::string_view, 1> kFFICallMethods     = {"call"};
inline constexpr std::array<std::string_view, 6> kFabricMountMethods = {
    "mount", "update", "setSize", "setFrame", "measure", "unmount",
};
inline constexpr std::array<std::string_view, 6> kFabricAsyncMethods = {
    "mountAsync", "updateAsync", "setSizeAsync", "setFrameAsync", "measureAsync", "unmountAsync",
};
inline constexpr std::array<std::string_view, 0> kClientProvidedMethods = {};
inline constexpr std::array<std::string_view, 5> kJavaClassMethods      = {
    "getClass", "className", "describe", "respondsTo", "release",
};
inline constexpr std::array<std::string_view, 1> kJavaConstructMethods   = {"construct"};
inline constexpr std::array<std::string_view, 2> kJavaFieldMethods       = {"getField", "setField"};
inline constexpr std::array<std::string_view, 1> kJavaInvokeMethods      = {"invoke"};
inline constexpr std::array<std::string_view, 1> kJavaInvokeAsyncMethods = {"invokeAsync"};
inline constexpr std::array<std::string_view, 5> kJavaHookMethods        = {
    "hook", "remove", "setReturnValue", "removeReturnValue", "clearReturnValues",
};
inline constexpr std::array<std::string_view, 1> kJavaBatchMethods        = {"batch"};
inline constexpr std::array<std::string_view, 1> kDebugEvaluationMethods  = {"recordEvaluation"};
inline constexpr std::array<std::string_view, 1> kDebugEnvironmentMethods = {"environment"};
inline constexpr std::array<std::string_view, 2> kUILookupMethods         = {"lookup", "snapshot"};
inline constexpr std::array<std::string_view, 3> kUIMountMethods  = {"mount", "update", "unmount"};
inline constexpr std::array<std::string_view, 2> kUILayoutMethods = {"measure", "setFrame"};

inline constexpr std::array<NativeCapabilityBinding, 26> kNativeCapabilityBindings = {{
    {"native.objc.classes", "objc", kObjCClassMethods},
    {"native.objc.invoke", "objc", kObjCInvokeMethods},
    {"native.objc.invokeAsync", "objc", kObjCInvokeAsyncMethods},
    {"native.objc.batch", "objc", kObjCBatchMethods},
    {"native.objc.snapshot", "objc", kObjCSnapshotMethods},
    {"native.objc.ivars", "objc", kObjCIvarMethods},
    {"native.objc.associations", "objc", kAssociationMethods},
    {"native.objc.hooks", "objc", kObjCHookMethods},
    {"native.ffi.symbols", "ffi", kFFISymbolMethods},
    {"native.ffi.call", "ffi", kFFICallMethods},
    {"native.fabric.mount", "fabric", kFabricMountMethods},
    {"native.fabric.async", "fabric", kFabricAsyncMethods},
    {"native.runtime.events", "runtime", kClientProvidedMethods},
    {"native.java.classes", "java", kJavaClassMethods},
    {"native.java.construct", "java", kJavaConstructMethods},
    {"native.java.fields", "java", kJavaFieldMethods},
    {"native.java.invoke", "java", kJavaInvokeMethods},
    {"native.java.invokeAsync", "java", kJavaInvokeAsyncMethods},
    {"native.java.hooks", "hooks", kJavaHookMethods},
    {"native.java.batch", "java", kJavaBatchMethods},
    {"native.java.associations", "java", kAssociationMethods},
    {"native.debug.evaluations", "debug", kDebugEvaluationMethods},
    {"native.debug.environment", "debug", kDebugEnvironmentMethods},
    {"native.ui.lookup", "ui", kUILookupMethods},
    {"native.ui.mount", "ui", kUIMountMethods},
    {"native.ui.layout", "ui", kUILayoutMethods},
}};

inline constexpr std::array<const char *, 15> kIOSNativePluginCapabilities = {
    "native.objc.classes",      "native.objc.invoke",       "native.objc.invokeAsync",
    "native.objc.batch",        "native.objc.snapshot",     "native.objc.ivars",
    "native.objc.associations", "native.objc.hooks",        "native.ffi.symbols",
    "native.ffi.call",          "native.fabric.mount",      "native.fabric.async",
    "native.runtime.events",    "native.debug.evaluations", "native.debug.environment",
};

inline constexpr std::array<const char *, 17> kAndroidNativePluginCapabilities = {
    "native.ui.lookup",         "native.ui.layout",         "native.ui.mount",
    "native.runtime.events",    "native.java.classes",      "native.java.invoke",
    "native.java.invokeAsync",  "native.java.fields",       "native.java.construct",
    "native.java.hooks",        "native.java.batch",        "native.java.associations",
    "native.debug.evaluations", "native.debug.environment", "native.fabric.async",
    "native.ffi.symbols",       "native.ffi.call",
};

using InstalledNativeMethods =
    std::map<std::string, std::set<std::string, std::less<>>, std::less<>>;

struct NativeCapabilityReport {
    std::vector<std::string> advertised;
    std::vector<std::string> diagnostics;
};

std::span<const char *const>   expectedNativePluginCapabilities(NativePluginPlatform platform);
const NativeCapabilityBinding *findNativeCapabilityBinding(std::string_view capability);
std::vector<std::string> missingNativeCapabilityMethods(const NativeCapabilityBinding &binding,
                                                        const InstalledNativeMethods  &installed);
NativeCapabilityReport   resolveNativePluginCapabilities(NativePluginPlatform          platform,
                                                         const InstalledNativeMethods &installed);

class NativePluginRootBuilder
{
public:
    NativePluginRootBuilder(facebook::jsi::Runtime &runtime, NativePluginPlatform platform);

    void addNamespace(const std::string &name, facebook::jsi::Object methods);
    void install();

private:
    facebook::jsi::Runtime                                    &runtime_;
    NativePluginPlatform                                       platform_;
    std::vector<std::pair<std::string, facebook::jsi::Object>> namespaces_;
};
}
