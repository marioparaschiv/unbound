#import "NativePluginHookDispatch.h"

#import <Foundation/Foundation.h>
#include <atomic>
#include <cstring>
#include <dispatch/dispatch.h>
#include <exception>
#include <functional>
#include <memory>
#include <mutex>
#include <optional>
#include <set>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

#import "LoaderAddonActivity.h"
#include "LoaderThreadWarnings.h"
#import "Logger.h"
#import "NativeHookKeys.h"
#import "NativeHookOptions.h"
#import "NativePluginHookReturnCache.h"
#import "NativePluginHooks.h"
#import "NativePluginInvocation.h"
#import "NativePluginObjCValues.h"
#import "NativePluginRuntime.h"
#import "NativePluginThreading.h"
#import "NativeRuntimeResources.h"

using namespace facebook;
using namespace facebook::jsi;

namespace loader::ios {
namespace {
    struct HookInvocation {
        std::shared_ptr<HookDispatcher>              dispatcher;
        std::vector<std::vector<uint8_t>>            arguments;
        std::vector<std::shared_ptr<ObjCHandleHost>> retainedObjects;
        std::vector<std::string>                     retainedStrings;
        std::vector<uint8_t>                         originalResult;
        void                                       **nativeArguments = nullptr;
        void                                        *returnValue     = nullptr;
        std::thread::id                              hookThread;
        std::mutex                                   lifecycleMutex;
        std::atomic_bool                             active{true};
        std::atomic_bool                             originalCalled{false};
        std::atomic_bool                             deferredOriginalRequested{false};
        std::vector<std::pair<size_t, void *>>       deferredReplacements;
        void                                        *originalObject = nullptr;
    };
}

static std::shared_ptr<HookInvocation>
hookInvocation(const std::shared_ptr<HookDispatcher> &dispatcher, void **arguments,
               void *returnValue)
{
    auto invocation             = std::make_shared<HookInvocation>();
    invocation->dispatcher      = dispatcher;
    invocation->nativeArguments = arguments;
    invocation->returnValue     = returnValue;
    invocation->hookThread      = std::this_thread::get_id();
    invocation->arguments.reserve(dispatcher->signature->arguments.size());
    invocation->retainedObjects.reserve(dispatcher->signature->arguments.size());
    invocation->retainedStrings.reserve(dispatcher->signature->arguments.size());
    for (const loader::ffi::Type &spec : dispatcher->signature->arguments)
    {
        size_t size = loader::ffi::valueStorageSize(spec);
        invocation->arguments.emplace_back(size);
        if (loader::ffi::typeSize(spec))
        {
            memcpy(invocation->arguments.back().data(), arguments[invocation->arguments.size() - 1],
                   loader::ffi::typeSize(spec));
        }
        if (spec.name == "object" || spec.name == "class")
        {
            void *rawObject = nullptr;
            memcpy(&rawObject, invocation->arguments.back().data(), sizeof(rawObject));
            id object = (__bridge id) rawObject;
            if (object)
            {
                invocation->retainedObjects.emplace_back(
                    std::make_shared<ObjCHandleHost>(object, liveObjCRetains()));
            }
        }
        else if (spec.name == "cstring")
        {
            const char *string = nullptr;
            memcpy(&string, invocation->arguments.back().data(), sizeof(string));
            if (string)
            {
                invocation->retainedStrings.emplace_back(string);
                string = invocation->retainedStrings.back().c_str();
                memcpy(invocation->arguments.back().data(), &string, sizeof(string));
            }
        }
    }
    return invocation;
}

static void copyHookResult(const std::shared_ptr<HookInvocation> &invocation, void *returnValue)
{
    if (invocation->dispatcher->signature->result.name == "void" || !returnValue)
    {
        invocation->originalResult.clear();
        return;
    }

    size_t size = loader::ffi::valueStorageSize(invocation->dispatcher->signature->result);
    invocation->originalResult.resize(size);
    memcpy(invocation->originalResult.data(), returnValue,
           loader::ffi::typeSize(invocation->dispatcher->signature->result));
}

static void applyDeferredHookReplacements(const std::shared_ptr<HookInvocation> &invocation)
{
    std::lock_guard<std::mutex> lock(invocation->lifecycleMutex);
    for (const auto &[index, rawObject] : invocation->deferredReplacements)
    {
        void *value = rawObject;
        memcpy(invocation->nativeArguments[index], &value, sizeof(value));
    }
    invocation->deferredReplacements.clear();
}

static void recordHookOriginalObject(const std::shared_ptr<HookInvocation> &invocation)
{
    if (invocation->dispatcher->signature->result.name != "object" || !invocation->returnValue)
        return;
    memcpy(&invocation->originalObject, invocation->returnValue, sizeof(void *));
}

static void balanceReplacedHookReturn(SEL                                    selector,
                                      const std::shared_ptr<HookDispatcher> &dispatcher,
                                      id receiver, void *originalObject, bool originalRan,
                                      void *returnValue)
{
    NativeMethodFamily family = nativeMethodFamily(selector);
    if (family == NativeMethodFamilyNone || dispatcher->signature->result.name != "object" ||
        !returnValue)
    {
        return;
    }
    void *replacement = nullptr;
    memcpy(&replacement, returnValue, sizeof(replacement));
    if (replacement)
        CFRetain(replacement);
    if (originalRan)
    {
        if (originalObject)
            CFRelease(originalObject);
        return;
    }
    if (family == NativeMethodFamilyInit && receiver)
        CFRelease((__bridge CFTypeRef) receiver);
}

static bool invokeDeferredHookOriginal(const std::shared_ptr<HookInvocation> &invocation)
{
    applyDeferredHookReplacements(invocation);
    if (!invocation->deferredOriginalRequested.exchange(false) || invocation->originalCalled.load())
    {
        return false;
    }

    invokeHookOriginal(invocation->dispatcher, invocation->nativeArguments,
                       invocation->returnValue);
    recordHookOriginalObject(invocation);
    copyHookResult(invocation, invocation->returnValue);
    invocation->originalCalled.store(true);
    return true;
}

static std::shared_ptr<std::vector<uint8_t>>
hookReturnBuffer(const std::shared_ptr<HookInvocation> &invocation)
{
    size_t size = loader::ffi::valueStorageSize(invocation->dispatcher->signature->result);
    return std::make_shared<std::vector<uint8_t>>(size);
}

static void copyHookReturnBuffer(const std::shared_ptr<HookInvocation>       &invocation,
                                 const std::shared_ptr<std::vector<uint8_t>> &buffer,
                                 void                                        *returnValue)
{
    if (invocation->dispatcher->signature->result.name == "void" || !returnValue)
    {
        return;
    }

    memcpy(returnValue, buffer->data(),
           loader::ffi::typeSize(invocation->dispatcher->signature->result));
}

static Value hookValue(Runtime &runtime, const loader::ffi::Type &type,
                       const std::vector<uint8_t> &bytes)
{
    if (type.name != "void" && bytes.size() < loader::ffi::typeSize(type))
    {
        throw JSError(runtime, "Native result buffer is too small");
    }
    return loader::ffi::readValue(runtime, type, bytes.data());
}

static bool firstHookWarning(loader::AddonSlot addon, const std::string &name,
                             const std::string &kind)
{
    static std::mutex            warnedMutex;
    static std::set<std::string> warned;
    std::lock_guard<std::mutex>  lock(warnedMutex);
    return warned.insert(std::to_string(addon) + " " + name + " " + kind).second;
}

static void logDroppedHookCall(loader::AddonSlot addon, SEL selector, const std::string &call)
{
    std::string name = sel_getName(selector);
    if (!firstHookWarning(addon, name, call))
    {
        return;
    }
    std::string reason =
        "the " + name + " hook answered after its 100 ms limit, so its " + call + " was dropped";
    [Logger error:LOG_CATEGORY_PLUGINS
           format:@"%s", loader::threading::hookFailureMessage(addon, reason).c_str()];
}

static bool hookRuntimeMatches(const std::shared_ptr<HookState> &state, Runtime &runtime)
{
    auto runtimeResources = loader::native::runtimeResourceRegistry(runtime);
    return runtimeResources->active() &&
           runtimeResources->identity() == state->callbackRuntimeIdentity;
}

static bool runHookCallback(const std::shared_ptr<HookState> &state, SEL selector,
                            std::function<void(Runtime &)> callback)
{
    auto operation = loader::native::beginRuntimeResourceOperation(state->callbackResources,
                                                                   state->callbackRuntimeIdentity);
    if (!operation)
    {
        return false;
    }
    if (!state->operations->track(operation))
    {
        operation->cancel();
        return false;
    }
    bool invoked = false;
    if (state->inlineRuntime && [NSThread isMainThread] &&
        state->runtimeGeneration == loader::native::runtimeGeneration())
    {
        loader::native::withRuntimeResource(
            state->callbackResources, state->callbackRuntimeIdentity, operation,
            [&](loader::native::RuntimeResourceRegistry &resources) {
                if (!state->active.load() || !hookRuntimeMatches(state, *state->inlineRuntime))
                {
                    return;
                }
                resources.drainDeferredReleases();
                callback(*state->inlineRuntime);
                invoked = true;
            });
        if (invoked)
        {
            return true;
        }
    }

    bool completed = false;
    if (!state->inlineRuntime)
    {
        auto invokedForRuntime = std::make_shared<std::atomic_bool>(false);
        completed = executeRuntimeSynchronously([state, callback = std::move(callback), operation,
                                                 invokedForRuntime](Runtime &runtime) {
            if (!state->active.load() ||
                state->runtimeGeneration != loader::native::runtimeGeneration())
            {
                return;
            }
            loader::native::withRuntimeResource(
                state->callbackResources, state->callbackRuntimeIdentity, operation,
                [&](loader::native::RuntimeResourceRegistry &resources) {
                    if (!state->active.load() || !hookRuntimeMatches(state, runtime))
                    {
                        return;
                    }
                    resources.drainDeferredReleases();
                    callback(runtime);
                    invokedForRuntime->store(true, std::memory_order_release);
                });
        });
        if (!completed)
        {
            operation->cancel();
        }
        completed = completed && invokedForRuntime->load(std::memory_order_acquire);
    }
    std::string name = sel_getName(selector);
    if (!completed && firstHookWarning(state->addon, name, "skipped"))
    {
        [Logger warning:LOG_CATEGORY_PLUGINS
                 format:@"%s", loader::threading::hookSkippedMessage(state->addon, name).c_str()];
    }
    return completed;
}

static Object hookContext(Runtime &runtime, const std::shared_ptr<HookInvocation> &invocation,
                          id object, SEL selector, bool allowOriginal,
                          const std::shared_ptr<HookState> &state, const char *phase)
{
    Object context(runtime);
    if (state->payload.receiver)
    {
        context.setProperty(
            runtime, "self",
            Object::createFromHostObject(runtime, std::make_shared<ObjCHandleHost>(object)));
    }
    context.setProperty(runtime, "selector",
                        String::createFromUtf8(runtime, sel_getName(selector)));

    size_t              explicitCount = invocation->dispatcher->signature->arguments.size() - 2;
    std::vector<size_t> argumentIndexes =
        loader::native::payloadArgumentIndexes(state->payload, explicitCount);
    Array values(runtime, argumentIndexes.size());
    Array indexValues(runtime, argumentIndexes.size());
    for (size_t index = 0; index < argumentIndexes.size(); index++)
    {
        size_t argumentIndex = argumentIndexes[index];
        values.setValueAtIndex(
            runtime, index,
            hookValue(runtime, invocation->dispatcher->signature->arguments[argumentIndex + 2],
                      invocation->arguments[argumentIndex + 2]));
        indexValues.setValueAtIndex(runtime, index, Value(static_cast<double>(argumentIndex)));
    }
    context.setProperty(runtime, "args", std::move(values));
    context.setProperty(runtime, "argumentIndexes", std::move(indexValues));
    context.setProperty(runtime, "phase", String::createFromUtf8(runtime, phase));

    auto original = invocation;
    context.setProperty(
        runtime, "replaceObjectArgument",
        Function::createFromHostFunction(
            runtime, PropNameID::forUtf8(runtime, "replaceObjectArgument"), 2,
            [original, allowOriginal, addon = state->addon, selector, argumentIndexes](
                Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                std::lock_guard<std::mutex> lock(original->lifecycleMutex);
                if (!original->active.load())
                {
                    if (allowOriginal)
                    {
                        logDroppedHookCall(addon, selector, "argument replacement");
                    }
                    throw JSError(rt,
                                  "Native hook arguments are unavailable after the hook returns");
                }
                if (!allowOriginal)
                {
                    throw JSError(rt, "Native hook arguments can only be replaced synchronously");
                }
                if (count < 2 || !args[0].isNumber())
                {
                    throw JSError(rt,
                                  "Native hook replaceObjectArgument expects an index and object");
                }

                size_t selectedIndex = loader::native::selectedPayloadArgument(
                    rt, args[0].getNumber(), argumentIndexes.size());

                size_t                   argumentIndex = argumentIndexes[selectedIndex] + 2;
                const loader::ffi::Type &spec =
                    original->dispatcher->signature->arguments[argumentIndex];
                if (spec.name != "object" && spec.name != "class")
                {
                    throw JSError(rt, "Native hook argument is not an Objective-C object");
                }

                id    object    = args[1].isNull() ? nil : objcValue(rt, args[1]);
                void *rawObject = (__bridge void *) object;
                if (object)
                {
                    original->retainedObjects.emplace_back(
                        std::make_shared<ObjCHandleHost>(object, liveObjCRetains()));
                }
                memcpy(original->arguments[argumentIndex].data(), &rawObject, sizeof(rawObject));
                if (std::this_thread::get_id() != original->hookThread)
                {
                    original->deferredReplacements.emplace_back(argumentIndex, rawObject);
                    return Value::undefined();
                }
                memcpy(original->nativeArguments[argumentIndex], &rawObject, sizeof(rawObject));
                return Value::undefined();
            }));
    context.setProperty(
        runtime, "original",
        Function::createFromHostFunction(
            runtime, PropNameID::forUtf8(runtime, "original"), 0,
            [original, allowOriginal, addon = state->addon,
             selector](Runtime &rt, const Value &, const Value *, size_t) -> Value {
                std::lock_guard<std::mutex> lock(original->lifecycleMutex);
                if (!original->active.load())
                {
                    if (allowOriginal)
                    {
                        logDroppedHookCall(addon, selector, "original() call");
                    }
                    throw JSError(rt,
                                  "Native hook original() is unavailable after the hook returns");
                }
                if (!allowOriginal)
                {
                    throw JSError(rt, "Native hook original() is only available synchronously");
                }
                if (!original->originalCalled.load())
                {
                    if (std::this_thread::get_id() != original->hookThread)
                    {
                        if (original->dispatcher->signature->result.name != "void")
                        {
                            throw JSError(rt,
                                          "Native hook original() cannot cross runtime threads");
                        }
                        original->deferredOriginalRequested.store(true);
                        return Value::undefined();
                    }

                    invokeHookOriginal(original->dispatcher, original->nativeArguments,
                                       original->returnValue);
                    recordHookOriginalObject(original);
                    copyHookResult(original, original->returnValue);
                    original->originalCalled.store(true);
                }
                return hookValue(rt, original->dispatcher->signature->result,
                                 original->originalResult);
            }));
    return context;
}

bool setHookReturn(Runtime &runtime, const loader::ffi::Type &spec, const Value &value,
                   void *returnValue)
{
    if (spec.name == "void")
    {
        return true;
    }
    if (!returnValue)
    {
        return false;
    }

    std::vector<uint8_t>         bytes(loader::ffi::valueStorageSize(spec));
    loader::ffi::ArgumentStorage storage;
    loader::ffi::writeValue(runtime, value, spec, bytes.data(), storage);
    memcpy(returnValue, bytes.data(), loader::ffi::typeSize(spec));
    return true;
}

namespace {
    struct HookCallGuard {
        explicit HookCallGuard(std::shared_ptr<HookDispatcher> dispatcher)
            : dispatcher(std::move(dispatcher)), signpost("hook dispatch")
        {
        }

        ~HookCallGuard()
        {
            dispatcher->activeCalls.fetch_sub(1);
        }

        std::shared_ptr<HookDispatcher> dispatcher;
        NativeOperationSignpost         signpost;
    };
}

static void logHookFailure(const std::exception &exception)
{
    std::optional<std::string> message =
        loader::threading::throttledHookFailure(loader::currentAddon(), exception.what());
    if (message)
    {
        [Logger error:LOG_CATEGORY_PLUGINS format:@"%s", message->c_str()];
    }
}

void dispatchFFIHookBody(ffi_cif *, void *returnValue, void **arguments, void *userData)
{
    __unsafe_unretained id object = nil;
    memcpy(&object, arguments[0], sizeof(object));
    SEL  selector   = *reinterpret_cast<SEL *>(arguments[1]);
    auto dispatcher = findHookDispatcher(object, selector, userData);
    if (!dispatcher)
    {
        return;
    }

    HookCallGuard                           guard(dispatcher);
    std::vector<std::shared_ptr<HookState>> hooks = activeHookStates(dispatcher, object);
    if (hooks.empty())
    {
        invokeHookOriginal(dispatcher, arguments, returnValue);
        return;
    }

    bool cacheOnly = true;
    for (const std::shared_ptr<HookState> &state : hooks)
    {
        if (state->active && !state->cacheOnly)
        {
            cacheOnly = false;
            break;
        }
    }
    if (cacheOnly)
    {
        bool                                    cachedReturn = false;
        std::vector<std::shared_ptr<HookState>> onceHooks;
        for (const std::shared_ptr<HookState> &state : hooks)
        {
            if (!state->active)
            {
                continue;
            }

            if (applyCachedHookReturn(state, dispatcher, arguments, returnValue))
            {
                cachedReturn = true;
            }
            if (state->once)
            {
                onceHooks.push_back(state);
            }
        }

        if (!cachedReturn)
        {
            invokeHookOriginal(dispatcher, arguments, returnValue);
        }
        else
        {
            balanceReplacedHookReturn(selector, dispatcher, object, nullptr, false, returnValue);
        }
        for (const std::shared_ptr<HookState> &state : onceHooks)
        {
            removeHook(state);
        }
        return;
    }

    auto invocation = hookInvocation(dispatcher, arguments, returnValue);

    bool                                    replacementApplied = false;
    bool                                    originalCalled     = false;
    std::vector<std::shared_ptr<HookState>> onceHooks;

    for (const std::shared_ptr<HookState> &state : hooks)
    {
        if (!state->active)
        {
            continue;
        }

        loader::AddonScope addonScope(state->addon);
        if (state->cacheOnly)
        {
            if (applyCachedHookReturn(state, dispatcher, arguments, returnValue))
            {
                replacementApplied = true;
            }
            if (state->once)
            {
                onceHooks.push_back(state);
            }
            continue;
        }

        if (state->hasBefore)
        {
            try
            {
                runHookCallback(state, selector,
                                [invocation, object, selector, state](Runtime &runtime) {
                                    auto callbacks = state->callbacks.lock();
                                    if (!callbacks || !callbacks->before)
                                    {
                                        return;
                                    }
                                    Object context = hookContext(runtime, invocation, object,
                                                                 selector, true, state, "before");
                                    callbacks->before->call(runtime, context);
                                });
            }
            catch (const std::exception &exception)
            {
                logHookFailure(exception);
            }
            if (invokeDeferredHookOriginal(invocation))
                originalCalled = true;
        }

        if (invocation->originalCalled.load() && !originalCalled)
        {
            originalCalled = true;
        }

        if (state->hasReplace)
        {
            try
            {
                std::shared_ptr<std::vector<uint8_t>> replacementResult =
                    hookReturnBuffer(invocation);
                bool completed = runHookCallback(
                    state, selector,
                    [invocation, object, selector, state, replacementResult](Runtime &runtime) {
                        auto callbacks = state->callbacks.lock();
                        if (!callbacks || !callbacks->replace)
                        {
                            throw std::runtime_error("Native hook callback expired");
                        }
                        Object context = hookContext(runtime, invocation, object, selector, true,
                                                     state, "replace");
                        Value  result  = callbacks->replace->call(runtime, context);
                        if (!setHookReturn(runtime, invocation->dispatcher->signature->result,
                                           result, replacementResult->data()))
                        {
                            throw JSError(runtime,
                                          "Native hook replacement returned an unsupported value");
                        }
                    });
                if (completed)
                {
                    replacementApplied = true;
                    copyHookReturnBuffer(invocation, replacementResult, returnValue);
                    copyHookResult(invocation, returnValue);
                }
            }
            catch (const std::exception &exception)
            {
                logHookFailure(exception);
            }
            if (invokeDeferredHookOriginal(invocation))
                originalCalled = true;
        }

        if (state->once)
        {
            onceHooks.push_back(state);
        }
    }

    if (!originalCalled && !replacementApplied)
    {
        invokeHookOriginal(dispatcher, arguments, returnValue);
        copyHookResult(invocation, returnValue);
    }
    else if (replacementApplied)
    {
        balanceReplacedHookReturn(selector, dispatcher, object, invocation->originalObject,
                                  invocation->originalCalled.load(), returnValue);
    }

    for (const std::shared_ptr<HookState> &state : hooks)
    {
        if (!state->active || !state->hasAfter)
        {
            continue;
        }

        loader::AddonScope             addonScope(state->addon);
        __strong id                    retainedObject = object;
        std::function<void(Runtime &)> afterWork      = [invocation, retainedObject, selector,
                                                         state](Runtime &runtime) {
            if (state->runtimeGeneration != loader::native::runtimeGeneration())
            {
                return;
            }
            bool pending = state->afterOncePending.exchange(false);
            if (!state->active.load() && !pending)
            {
                return;
            }
            auto callbacks = state->callbacks.lock();
            if (!callbacks || !callbacks->after)
                return;
            loader::AddonScope runtimeScope(state->addon);
            try
            {
                Object context = hookContext(runtime, invocation, retainedObject, selector, false,
                                             state, "after");
                callbacks->after->call(runtime, context);
            }
            catch (const std::exception &exception)
            {
                logHookFailure(exception);
            }
            if (pending)
            {
                loader::native::releaseRuntimeResource(runtime, state->callbackResourceKey);
            }
        };
        auto operation = loader::native::beginRuntimeResourceOperation(
            state->callbackResources, state->callbackRuntimeIdentity);
        if (!operation)
        {
            continue;
        }
        if (!state->operations->track(operation))
        {
            operation->cancel();
            continue;
        }
        if (state->coalesceAfter)
        {
            std::string key = loader::native::receiverCoalesceKey(
                loader::native::kIOSHookPlatform, std::to_string(state->identifier),
                std::to_string(reinterpret_cast<uintptr_t>((__bridge void *) retainedObject)));
            loader::native::executeRuntimeCoalesced(
                std::move(key), [state, afterWork, operation](Runtime &runtime) {
                    if (state->runtimeGeneration != loader::native::runtimeGeneration())
                    {
                        return;
                    }
                    loader::native::withRuntimeResource(
                        state->callbackResources, state->callbackRuntimeIdentity, operation,
                        [&](loader::native::RuntimeResourceRegistry &resources) {
                            if (!hookRuntimeMatches(state, runtime))
                            {
                                return;
                            }
                            resources.drainDeferredReleases();
                            afterWork(runtime);
                        });
                });
        }
        else if (!state->inlineRuntime)
        {
            executeRuntimeAsynchronously([state, afterWork, operation](Runtime &runtime) {
                if (state->runtimeGeneration != loader::native::runtimeGeneration())
                {
                    return;
                }
                loader::native::withRuntimeResource(
                    state->callbackResources, state->callbackRuntimeIdentity, operation,
                    [&](loader::native::RuntimeResourceRegistry &resources) {
                        if (!hookRuntimeMatches(state, runtime))
                        {
                            return;
                        }
                        resources.drainDeferredReleases();
                        afterWork(runtime);
                    });
            });
        }
        else if ([NSThread isMainThread])
        {
            loader::native::withRuntimeResource(
                state->callbackResources, state->callbackRuntimeIdentity, operation,
                [&](loader::native::RuntimeResourceRegistry &resources) {
                    if (!hookRuntimeMatches(state, *state->inlineRuntime))
                    {
                        return;
                    }
                    resources.drainDeferredReleases();
                    afterWork(*state->inlineRuntime);
                });
        }
        else
        {
            dispatch_async(dispatch_get_main_queue(), ^{
                if (state->active.load() && state->inlineRuntime &&
                    state->runtimeGeneration == loader::native::runtimeGeneration())
                {
                    loader::native::withRuntimeResource(
                        state->callbackResources, state->callbackRuntimeIdentity, operation,
                        [&](loader::native::RuntimeResourceRegistry &resources) {
                            if (!hookRuntimeMatches(state, *state->inlineRuntime))
                            {
                                return;
                            }
                            resources.drainDeferredReleases();
                            afterWork(*state->inlineRuntime);
                        });
                }
            });
        }
    }

    {
        std::lock_guard<std::mutex> lock(invocation->lifecycleMutex);
        invocation->active.store(false);
    }

    for (const std::shared_ptr<HookState> &state : onceHooks)
    {
        removeHook(state, true);
    }
}

void dispatchFFIHook(ffi_cif *cif, void *returnValue, void **arguments, void *userData)
{
    @autoreleasepool
    {
        dispatchFFIHookBody(cif, returnValue, arguments, userData);
    }
}
}
