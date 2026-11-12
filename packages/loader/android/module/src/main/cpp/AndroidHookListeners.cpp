#include "AndroidHookListeners.h"

#include <algorithm>
#include <cmath>
#include <functional>
#include <iterator>
#include <jsi/instrumentation.h>
#include <memory>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <string>
#include <sys/types.h>
#include <unistd.h>
#include <unordered_map>
#include <vector>

#include "AndroidJavaValues.h"
#include "JavaHandleRelease.h"
#include "JniCall.h"
#include "LoaderAddonActivity.h"
#include "LoaderBootstrap.h"
#include "LoaderJSIJSON.h"
#include "LoaderLog.h"
#include "LoaderThreadWarnings.h"
#include "NativeBoundedValue.h"
#include "NativeEvaluations.h"
#include "NativeFFI.h"
#include "NativeFabric.h"
#include "NativeGeometry.h"
#include "NativeHandleLeases.h"
#include "NativeHookCallbacks.h"
#include "NativeHookKeys.h"
#include "NativeHookReturnCache.h"
#include "NativeLimits.h"
#include "NativePlatformBridge.h"
#include "NativePluginBridge.h"
#include "NativePluginRoot.h"
#include "NativeResourceBudget.h"
#include "NativeRuntimeResources.h"
#include "NativeTaggedValue.h"
#include "NativeTraversalOptions.h"
#include "NativeUIScope.h"

namespace unbound::android {
namespace jsi = facebook::jsi;

static constexpr const char *kCatchingCallName = "__unboundCatchingCall";

static jsi::Function catchingCall(jsi::Runtime &runtime)
{
    jsi::Object global = runtime.global();
    jsi::Value  cached = global.getProperty(runtime, kCatchingCallName);
    if (cached.isObject() && cached.asObject(runtime).isFunction(runtime))
    {
        return cached.asObject(runtime).asFunction(runtime);
    }
    std::optional<jsi::Function> created =
        loader::bootstrap::function(runtime, loader::bootstrap::kCatchingCall);
    if (!created)
    {
        throw jsi::JSError(runtime, "The catching-call bootstrap script is unavailable.");
    }
    global.setProperty(runtime, kCatchingCallName, *created);
    return std::move(*created);
}

struct HookListener {
    std::weak_ptr<jsi::Function>                                   callback;
    std::weak_ptr<loader::native::RuntimeResourceRegistry>         resources;
    std::shared_ptr<loader::native::RuntimeResourceOperationScope> operations;
    JavaCallbacks                                                  callbacks;
    loader::AddonSlot                                              addon    = loader::kNoAddon;
    bool                                                           coalesce = false;
    bool                                                           rewritesArguments = false;
    jsi::Runtime                                                  *inlineRuntime     = nullptr;
    uint64_t                                                       runtimeIdentity   = 0;
    uint64_t                                                       runtimeGeneration = 0;
};

bool onMainThread()
{
    return gettid() == getpid();
}

static std::mutex                                    gHookMutex;
static std::unordered_map<std::string, HookListener> gHookListeners;

static std::string hookListenerKey(const std::string &token)
{
    return loader::native::hookCallbackKey(loader::native::kAndroidHookPlatform, token);
}

static std::optional<std::string> rewrittenArguments(jsi::Runtime     &runtime,
                                                     const jsi::Value &returned)
{
    if (!returned.isObject())
    {
        return std::nullopt;
    }
    jsi::Value result = returned.asObject(runtime).getProperty(runtime, "result");
    if (!result.isObject())
    {
        return std::nullopt;
    }
    jsi::Value arguments = result.asObject(runtime).getProperty(runtime, "arguments");
    if (!arguments.isObject() || !arguments.asObject(runtime).isArray(runtime))
    {
        return std::nullopt;
    }
    return serializeJavaArguments(runtime, &arguments, 1, 0);
}

std::optional<std::string> dispatchHookEvent(const std::string &token, const std::string &payload)
{
    uint64_t     dispatchGeneration = loader::native::runtimeGeneration();
    HookListener listener;
    bool         listening = false;
    {
        std::lock_guard<std::mutex> lock(gHookMutex);
        auto                        found = gHookListeners.find(token);
        if (found != gHookListeners.end())
        {
            listener  = found->second;
            listening = true;
        }
    }
    if (!listening)
    {
        std::optional<JavaCallbacks> callbacks = javaReleaseCallbacks();
        if (callbacks && dispatchGeneration == loader::native::runtimeGeneration())
        {
            releaseJavaHandleIssues(javaHandleReleaser(*callbacks), payload);
        }
        return std::nullopt;
    }
    auto pendingEvent = pendingJavaPayload(listener.callbacks, payload);
    if (!listener.operations || !listener.operations->active())
    {
        return std::nullopt;
    }

    auto operation =
        loader::native::beginRuntimeResourceOperation(listener.resources, listener.runtimeIdentity);
    if (!operation || !listener.operations->track(operation))
    {
        if (operation)
        {
            operation->cancel();
        }
        return std::nullopt;
    }

    loader::AddonScope scope(listener.addon);
    auto               deliver =
        [callback = listener.callback, operations = listener.operations, operation,
         identity = listener.runtimeIdentity, generation = listener.runtimeGeneration,
         addon = listener.addon, pendingEvent, rewrites = listener.rewritesArguments](
            jsi::Runtime                            &runtime,
            loader::native::RuntimeResourceRegistry &resources) -> std::optional<std::string> {
        if (!operations->active() || !operation->active() ||
            generation != loader::native::runtimeGeneration())
        {
            return std::nullopt;
        }
        auto runtimeResources = loader::native::runtimeResourceRegistry(runtime);
        if (!runtimeResources->active() || runtimeResources->identity() != identity)
        {
            return std::nullopt;
        }
        resources.drainDeferredReleases();
        auto activeCallback = callback.lock();
        if (!activeCallback)
        {
            return std::nullopt;
        }
        loader::AddonScope        runtimeScope(addon);
        std::optional<jsi::Value> event = adoptTaggedJavaEvent(runtime, pendingEvent->payload());
        if (!event)
        {
            nlohmann::json parsed = nlohmann::json::parse(pendingEvent->payload(), nullptr, false);
            if (parsed.is_discarded())
            {
                return std::nullopt;
            }
            event = adoptJavaValue(runtime, parsed);
        }
        pendingEvent->transfer();

        jsi::Value failure = catchingCall(runtime).call(
            runtime, jsi::Value(runtime, *activeCallback), std::move(*event));
        if (!failure.isString())
        {
            return rewrites ? rewrittenArguments(runtime, failure) : std::nullopt;
        }
        std::optional<std::string> message =
            loader::threading::throttledHookFailure(addon, failure.asString(runtime).utf8(runtime));
        if (message)
        {
            loader::log(loader::LogLevel::Error, LOG_CATEGORY_PLUGINS, *message);
        }
        return std::nullopt;
    };

    if (listener.coalesce)
    {
        std::optional<std::string> key =
            loader::native::coalescedHookKey(loader::native::kAndroidHookPlatform, token, payload);
        if (key)
        {
            loader::native::executeRuntimeCoalesced(
                std::move(*key),
                [deliver, resources = listener.resources, identity = listener.runtimeIdentity,
                 operation](jsi::Runtime &runtime) {
                    loader::native::withRuntimeResource(
                        resources, identity, operation,
                        [&](loader::native::RuntimeResourceRegistry &owner) {
                            deliver(runtime, owner);
                        });
                });
            return std::nullopt;
        }
    }

    if (!listener.inlineRuntime)
    {
        loader::native::executeRuntimeAsynchronously([deliver, resources = listener.resources,
                                                      identity = listener.runtimeIdentity,
                                                      operation](jsi::Runtime &runtime) {
            loader::native::withRuntimeResource(
                resources, identity, operation,
                [&](loader::native::RuntimeResourceRegistry &owner) {
                    deliver(runtime, owner);
                });
        });
        return std::nullopt;
    }
    if (onMainThread())
    {
        std::optional<std::string> rewritten;
        if (listener.runtimeGeneration == loader::native::runtimeGeneration())
        {
            loader::native::withRuntimeResource(
                listener.resources, listener.runtimeIdentity, operation,
                [&](loader::native::RuntimeResourceRegistry &owner) {
                    if (loader::native::runtimeResourceRegistry(*listener.inlineRuntime)
                            ->identity() == listener.runtimeIdentity)
                    {
                        rewritten = deliver(*listener.inlineRuntime, owner);
                    }
                });
        }
        return rewritten;
    }
    if (auto target = loader::native::executor())
    {
        auto inlineRuntime = listener.inlineRuntime;
        auto generation    = listener.runtimeGeneration;
        auto identity      = listener.runtimeIdentity;
        auto resources     = listener.resources;
        auto pending       = operation;
        target->runOnMain([deliver = std::move(deliver), inlineRuntime, generation, identity,
                           resources, pending]() {
            if (generation == loader::native::runtimeGeneration())
            {
                loader::native::withRuntimeResource(
                    resources, identity, pending,
                    [&](loader::native::RuntimeResourceRegistry &owner) {
                        if (loader::native::runtimeResourceRegistry(*inlineRuntime)->identity() ==
                            identity)
                        {
                            deliver(*inlineRuntime, owner);
                        }
                    });
            }
        });
    }
}

void rememberHookListener(jsi::Runtime &runtime, const std::string &token,
                          const jsi::Value &listener, bool coalesce, bool rewritesArguments,
                          JavaCallbacks callbacks)
{
    if (!listener.isObject() || !listener.asObject(runtime).isFunction(runtime))
    {
        return;
    }

    auto callback = std::make_shared<jsi::Function>(listener.asObject(runtime).asFunction(runtime));
    auto resources  = loader::native::runtimeResourceRegistry(runtime);
    auto operations = std::make_shared<loader::native::RuntimeResourceOperationScope>();
    loader::native::retainRuntimeResource(runtime, hookListenerKey(token), callback);
    HookListener                stored{callback,
                                       resources,
                                       operations,
                                       callbacks,
                                       loader::currentAddon(),
                                       coalesce,
                                       rewritesArguments,
                                       loader::native::currentUIScopeRuntime(),
                                       resources->identity(),
                                       loader::native::runtimeGeneration()};
    std::lock_guard<std::mutex> lock(gHookMutex);
    gHookListeners[token] = std::move(stored);
}

static void postToMain(std::function<void()> work)
{
    if (auto target = loader::native::executor())
    {
        target->runOnMain(std::move(work));
    }
}

static loader::native::HookCallbackOwner hookListenerOwner(const std::string  &token,
                                                           const HookListener &listener)
{
    return {listener.resources, listener.runtimeIdentity, hookListenerKey(token),
            listener.inlineRuntime != nullptr};
}

void forgetHookListener(const std::string &token)
{
    HookListener listener;
    bool         foundListener = false;
    {
        std::lock_guard<std::mutex> lock(gHookMutex);
        auto                        found = gHookListeners.find(token);
        if (found != gHookListeners.end())
        {
            listener = found->second;
            gHookListeners.erase(found);
            foundListener = true;
        }
    }
    if (!foundListener)
    {
        return;
    }
    listener.operations->cancelPending();
    loader::native::releaseHookCallbacks(hookListenerOwner(token, listener), postToMain);
}

static void retireHookListeners()
{
    std::unordered_map<std::string, HookListener> retired;
    {
        std::lock_guard<std::mutex> lock(gHookMutex);
        retired.swap(gHookListeners);
    }
    for (const auto &[token, listener] : retired)
    {
        listener.operations->cancelPending();
        loader::native::deferHookCallbackRelease(hookListenerOwner(token, listener), postToMain);
    }
}

std::string hookTokenId(jsi::Runtime &runtime, const jsi::Value &value)
{
    return loader::native::parseHandleId(runtime, value, "A hook token");
}

loader::native::NativeResourceRegistry &installedHooks()
{
    static loader::native::NativeResourceRegistry registry(loader::native::nativeHookBudget());
    return registry;
}

loader::native::HookReturnCache &hookReturnValues()
{
    static loader::native::HookReturnCache cache(loader::native::nativeCachedReturnBudget());
    return cache;
}

std::optional<std::string> hookReturnValue(const std::string &token, const std::string &self,
                                           const std::string &arguments)
{
    return hookReturnValues().findSerialized(token, self, arguments);
}

std::string installedHookToken(jsi::Runtime &runtime, const jsi::Value &value)
{
    std::string token = hookTokenId(runtime, value);
    if (!installedHooks().contains(token))
    {
        throw std::invalid_argument("The Android hook has been removed");
    }
    return token;
}

nlohmann::json boundedJSON(jsi::Runtime &runtime, const jsi::Value &value)
{
    NativeConversionBudget budget(kNativeArgumentsConversion);
    nlohmann::json         result = loader::native::serializeBounded(runtime, value, budget);
    loader::native::dumpBounded(result, kNativeArgumentsConversion);
    return result;
}

nlohmann::json boundedArgumentsJSON(jsi::Runtime &runtime, const jsi::Value &value)
{
    return nlohmann::json::parse(
        loader::native::serializeBoundedArguments(runtime, value, kNativeArgumentsConversion));
}

void watchRuntimeGenerations(const JavaCallbacks &callbacks)
{
    static std::once_flag watching;
    std::call_once(watching, [callbacks]() {
        loader::native::onRuntimeGenerationChanged([callbacks](uint64_t) {
            retireHookListeners();
            hookReturnValues().clearAll();
            installedHooks().releaseAll();
            invokeStaticVoid(callbacks.bridgeClass, callbacks.runtimeReplaced);
        });
    });
}
}
