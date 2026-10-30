#pragma once

#include <functional>
#include <jsi/jsi.h>
#include <optional>
#include <string>

namespace loader::bootstrap {
inline constexpr const char *kMetroModuleCapture = "metro-module-capture";
inline constexpr const char *kRunApplicationGate = "run-application-gate";
inline constexpr const char *kRuntimeReadiness   = "runtime-readiness";
inline constexpr const char *kRuntimeDiagnostics = "runtime-diagnostics";
inline constexpr const char *kNativeFailureGuard = "native-failure-guard";
inline constexpr const char *kPreload            = "preload";
inline constexpr const char *kBrowserLogin       = "browser-login";
inline constexpr const char *kDevtools           = "devtools";
inline constexpr const char *kCatchingCall       = "catching-call";

using ScriptSource = std::function<std::optional<std::string>(const std::string &name)>;

void                       setScriptSource(ScriptSource source);
std::optional<std::string> script(const std::string &name);

facebook::jsi::Value evaluate(facebook::jsi::Runtime &runtime, const std::string &name);
std::optional<facebook::jsi::Function> function(facebook::jsi::Runtime &runtime,
                                                const std::string      &name);
}
