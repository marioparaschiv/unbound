#pragma once

#include "AndroidLoader.h"

#include <optional>
#include <string>

namespace unbound::android
{
    void registerNativePluginBridge(facebook::jsi::Runtime &runtime,
                                    const JavaCallbacks &callbacks);

    void dispatchHookEvent(const std::string &token, const std::string &payload);

    std::optional<std::string> hookReturnValue(const std::string &token, const std::string &self,
                                               const std::string &arguments);
}
