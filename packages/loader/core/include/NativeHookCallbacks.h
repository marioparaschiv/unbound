#pragma once

#include <cstdint>
#include <functional>
#include <memory>
#include <string>

#include "NativeRuntimeResources.h"

namespace loader::native {
using MainThreadPost = std::function<void(std::function<void()>)>;

struct HookCallbackOwner {
    std::weak_ptr<RuntimeResourceRegistry> resources;
    uint64_t                               identity = 0;
    std::string                            key;
    bool                                   inlineRuntime = false;
};

void releaseHookCallbacks(const HookCallbackOwner &owner, const MainThreadPost &postToMain);
void deferHookCallbackRelease(const HookCallbackOwner &owner, const MainThreadPost &postToMain);
}
