#pragma once

#import <Foundation/Foundation.h>
#include <atomic>
#include <cstdint>
#include <jsi/jsi.h>
#include <memory>
#include <mutex>
#import <objc/runtime.h>
#include <string>
#include <vector>

#import "LoaderAddonActivity.h"
#import "NativeFFI.h"
#import "NativeHookOptions.h"
#import "NativeRuntimeResources.h"

namespace loader::ios {
struct HookSignature {
    loader::ffi::Type                           result;
    std::vector<loader::ffi::Type>              arguments;
    std::shared_ptr<loader::ffi::CallInterface> interface;
};

struct HookState;
struct HookDispatcher;

struct HookCallbacks {
    std::shared_ptr<facebook::jsi::Function> before;
    std::shared_ptr<facebook::jsi::Function> after;
    std::shared_ptr<facebook::jsi::Function> replace;
};

struct HookDispatcher {
    Class                                   cls;
    SEL                                     selector;
    IMP                                     original;
    std::shared_ptr<HookSignature>          signature;
    ffi_closure                            *closure = nullptr;
    void                                   *code    = nullptr;
    std::vector<std::shared_ptr<HookState>> hooks;
    std::atomic_uint                        activeCalls{0};
    std::atomic_bool                        retired{false};
};

struct HookState {
    uint64_t                                               identifier;
    uint64_t                                               runtimeGeneration;
    std::string                                            callbackResourceKey;
    std::weak_ptr<loader::native::RuntimeResourceRegistry> callbackResources;
    uint64_t                                               callbackRuntimeIdentity = 0;
    std::weak_ptr<HookCallbacks>                           callbacks;
    bool                                                   hasBefore     = false;
    bool                                                   hasAfter      = false;
    bool                                                   hasReplace    = false;
    bool                                                   coalesceAfter = false;
    std::weak_ptr<HookDispatcher>                          dispatcher;
    __strong id                                            instanceTarget = nil;
    std::mutex                                             returnCacheMutex;
    __strong NSMutableDictionary<NSArray *, NSData *> *returnCache =
        [NSMutableDictionary dictionary];
    bool                                                           cacheOnly = false;
    bool                                                           once      = false;
    loader::native::HookPayload                                    payload;
    facebook::jsi::Runtime                                        *inlineRuntime = nullptr;
    loader::AddonSlot                                              addon         = loader::kNoAddon;
    std::atomic_bool                                               active{true};
    std::atomic_bool                                               afterOncePending{false};
    std::shared_ptr<loader::native::RuntimeResourceOperationScope> operations =
        std::make_shared<loader::native::RuntimeResourceOperationScope>();
};

class HookTokenHost final : public facebook::jsi::HostObject
{
public:
    explicit HookTokenHost(std::shared_ptr<HookState> state) : state_(std::move(state)) {}

    std::shared_ptr<HookState> state(void) const
    {
        return state_;
    }

    facebook::jsi::Value get(facebook::jsi::Runtime          &runtime,
                             const facebook::jsi::PropNameID &name) override;

private:
    std::shared_ptr<HookState> state_;
};

void removeHook(const std::shared_ptr<HookState> &state, bool preserveAfter = false,
                bool restoreImplementation = true);
void invalidateRuntimeHooks(uint64_t generation);
std::shared_ptr<HookDispatcher> findHookDispatcher(id object, SEL selector,
                                                   void *closureData = nullptr);
std::vector<std::shared_ptr<HookState>>
activeHookStates(const std::shared_ptr<HookDispatcher> &dispatcher, id object);
void invokeHookOriginal(const std::shared_ptr<HookDispatcher> &dispatcher, void **arguments,
                        void *returnValue);
facebook::jsi::Value makeHook(facebook::jsi::Runtime &runtime, const facebook::jsi::Value *args,
                              size_t count);
}
