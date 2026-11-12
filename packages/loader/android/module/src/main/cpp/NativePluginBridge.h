#pragma once

#include <optional>
#include <string>

#include "AndroidLoader.h"

namespace unbound::android {
void registerNativePluginBridge(facebook::jsi::Runtime &runtime, const JavaCallbacks &callbacks);

std::optional<std::string> dispatchHookEvent(const std::string &token, const std::string &payload);

std::optional<std::string> hookReturnValue(const std::string &token, const std::string &self,
                                           const std::string &arguments);
}
