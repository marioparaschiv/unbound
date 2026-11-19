#pragma once

#include <chrono>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <string>

#include "LoaderAddonActivity.h"

namespace loader::native {
inline constexpr size_t kHookStormLimit = 1000;

using HookTargetName = std::function<std::string()>;

bool admitHookEvent(uint64_t hook, AddonSlot addon, const HookTargetName &target,
                    std::chrono::steady_clock::time_point now = std::chrono::steady_clock::now());
void forgetHookEvents(uint64_t hook);
}
