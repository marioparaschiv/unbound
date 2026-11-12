#pragma once

#include <jsi/jsi.h>
#include <memory>

#import "NativePluginHooks.h"

namespace loader::ios {
bool applyCachedHookReturn(const std::shared_ptr<HookState>      &state,
                           const std::shared_ptr<HookDispatcher> &dispatcher, void **arguments,
                           void *returnValue);
void setHookReturnCache(facebook::jsi::Runtime &runtime, const std::shared_ptr<HookState> &state,
                        const facebook::jsi::Value *args, size_t count);
void removeHookReturnCache(facebook::jsi::Runtime &runtime, const std::shared_ptr<HookState> &state,
                           const facebook::jsi::Value *args, size_t count);
void clearHookReturnCache(const std::shared_ptr<HookState> &state);
}
