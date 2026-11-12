#import "NativePluginHooks.h"

#include <algorithm>
#include <cmath>
#include <dispatch/dispatch.h>
#include <functional>
#include <substrate.h>
#include <unordered_map>

#import "NativeAddressValidation.h"
#import "NativeHookCallbacks.h"
#import "NativeHookKeys.h"
#import "NativePluginHookDispatch.h"
#import "NativePluginHookFallbacks.h"
#import "NativePluginHookReturnCache.h"
#import "NativePluginObjCValues.h"
#import "NativePluginRuntime.h"
#import "NativeResourceBudget.h"
#import "NativeTypeEncoding.h"
#import "NativeUIScope.h"

using namespace facebook;
using namespace facebook::jsi;

namespace loader::ios {
static std::mutex                                                            gHookMutex;
static std::unordered_map<std::string, std::shared_ptr<HookDispatcher>>      gDispatchers;
static std::unordered_map<HookDispatcher *, std::shared_ptr<HookDispatcher>> gClosureDispatchers;

static std::string hookKey(Class cls, SEL selector)
{
    return std::string(class_getName(cls)) + ":" + sel_getName(selector);
}

static void postToMain(std::function<void()> work)
{
    auto task = std::make_shared<std::function<void()>>(std::move(work));
    dispatch_async(dispatch_get_main_queue(), ^{ (*task)(); });
}

static void releaseHookCallbacks(const std::shared_ptr<HookState> &state)
{
    loader::native::releaseHookCallbacks({state->callbackResources, state->callbackRuntimeIdentity,
                                          state->callbackResourceKey,
                                          state->inlineRuntime != nullptr},
                                         postToMain);
}

void removeHook(const std::shared_ptr<HookState> &state, bool preserveAfter,
                bool restoreImplementation)
{
    if (!state)
    {
        return;
    }
    state->afterOncePending.store(preserveAfter && state->hasAfter);
    bool wasActive = state->active.exchange(false);
    if (!preserveAfter)
    {
        state->operations->cancelPending();
    }
    if (!wasActive)
    {
        if (!state->afterOncePending.load())
        {
            releaseHookCallbacks(state);
        }
        return;
    }
    loader::native::nativeHookBudget().release();
    clearHookReturnCache(state);
    if (!state->afterOncePending.load())
    {
        releaseHookCallbacks(state);
    }

    std::shared_ptr<HookDispatcher> dispatcher = state->dispatcher.lock();
    if (!dispatcher)
    {
        return;
    }

    {
        std::lock_guard<std::mutex> lock(gHookMutex);
        auto iterator = std::find(dispatcher->hooks.begin(), dispatcher->hooks.end(), state);
        if (iterator != dispatcher->hooks.end())
        {
            dispatcher->hooks.erase(iterator);
        }

        if (restoreImplementation && dispatcher->hooks.empty() && !dispatcher->retired.load())
        {
            Method method  = class_getInstanceMethod(dispatcher->cls, dispatcher->selector);
            IMP    current = method ? method_getImplementation(method) : nullptr;
            if (!method || current == (IMP) dispatcher->code || current == dispatcher->original)
            {
                if (method && current == (IMP) dispatcher->code)
                {
                    MSHookMessageEx(dispatcher->cls, dispatcher->selector, dispatcher->original,
                                    nullptr);
                }
                dispatcher->retired.store(true);
            }
        }
    }
}

void invalidateRuntimeHooks(uint64_t generation)
{
    std::vector<std::shared_ptr<HookState>> stale;
    {
        std::lock_guard<std::mutex> lock(gHookMutex);
        for (const auto &entry : gDispatchers)
        {
            for (const auto &state : entry.second->hooks)
            {
                if (state->runtimeGeneration < generation)
                    stale.push_back(state);
            }
        }
    }
    for (const auto &state : stale)
    {
        removeHook(state, false, false);
    }
}

Value HookTokenHost::get(Runtime &runtime, const PropNameID &name)
{
    std::string property = name.utf8(runtime);
    if (property == "remove")
    {
        std::shared_ptr<HookState> state = state_;
        return Function::createFromHostFunction(
            runtime, PropNameID::forUtf8(runtime, "remove"), 0,
            [state](Runtime &rt, const Value &, const Value *, size_t) -> Value {
                removeHook(state);
                return Value::undefined();
            });
    }
    if (property == "active")
    {
        return Value(state_ && state_->active.load());
    }
    if (property == "setReturnValue")
    {
        std::shared_ptr<HookState> state = state_;
        return Function::createFromHostFunction(
            runtime, PropNameID::forUtf8(runtime, "setReturnValue"), 3,
            [state](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                setHookReturnCache(rt, state, args, count);
                return Value::undefined();
            });
    }
    if (property == "removeReturnValue")
    {
        std::shared_ptr<HookState> state = state_;
        return Function::createFromHostFunction(
            runtime, PropNameID::forUtf8(runtime, "removeReturnValue"), 2,
            [state](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                removeHookReturnCache(rt, state, args, count);
                return Value::undefined();
            });
    }
    if (property == "clearReturnValues")
    {
        std::shared_ptr<HookState> state = state_;
        return Function::createFromHostFunction(
            runtime, PropNameID::forUtf8(runtime, "clearReturnValues"), 0,
            [state](Runtime &, const Value &, const Value *, size_t) -> Value {
                clearHookReturnCache(state);
                return Value::undefined();
            });
    }
    return Value::undefined();
}

void invokeHookOriginal(const std::shared_ptr<HookDispatcher> &dispatcher, void **arguments,
                        void *returnValue)
{
    loader::ffi::invoke(*dispatcher->signature->interface, (void *) dispatcher->original,
                        returnValue, arguments);
}

std::shared_ptr<HookDispatcher> findHookDispatcher(id object, SEL selector, void *closureData)
{
    std::lock_guard<std::mutex> lock(gHookMutex);
    if (closureData)
    {
        auto closure = gClosureDispatchers.find(static_cast<HookDispatcher *>(closureData));
        if (closure == gClosureDispatchers.end())
        {
            return nullptr;
        }
        closure->second->activeCalls.fetch_add(1);
        return closure->second;
    }
    auto  iterator = gDispatchers.end();
    Class cls      = object_getClass(object);
    while (cls && iterator == gDispatchers.end())
    {
        iterator = gDispatchers.find(hookKey(cls, selector));
        cls      = class_getSuperclass(cls);
    }
    if (iterator == gDispatchers.end())
    {
        return nullptr;
    }

    iterator->second->activeCalls.fetch_add(1);
    return iterator->second;
}

std::vector<std::shared_ptr<HookState>>
activeHookStates(const std::shared_ptr<HookDispatcher> &dispatcher, id object)
{
    std::vector<std::shared_ptr<HookState>> hooks;
    std::lock_guard<std::mutex>             lock(gHookMutex);
    for (const std::shared_ptr<HookState> &state : dispatcher->hooks)
    {
        if (state->active && state->runtimeGeneration == loader::native::runtimeGeneration() &&
            (!state->instanceTarget || state->instanceTarget == object))
        {
            hooks.push_back(state);
        }
    }
    return hooks;
}

Value makeHook(Runtime &runtime, const Value *args, size_t count)
{
    if (count < 3 || !args[0].isString() || !args[1].isString() || !args[2].isObject())
    {
        throw JSError(runtime, "objc.hook expects a class, selector, and handlers");
    }
    loader::native::NativeResourceReservation reservation(loader::native::nativeHookBudget(),
                                                          "Too many native hooks are installed");

    NSString *className    = jsiString(runtime, args[0]);
    NSString *selectorName = jsiString(runtime, args[1]);
    Class     cls          = NSClassFromString(className);
    SEL       selector     = NSSelectorFromString(selectorName);
    Method    method       = class_getInstanceMethod(cls, selector);
    if (!cls || !method)
    {
        throw JSError(runtime, "Objective-C hook target is unavailable");
    }

    NSMethodSignature *methodSignature =
        [NSMethodSignature signatureWithObjCTypes:method_getTypeEncoding(method)];
    auto        signature  = std::make_shared<HookSignature>();
    std::string resultName = nativeFFITypeName(methodSignature.methodReturnType);
    if (resultName.empty())
    {
        throw JSError(runtime, "Unsupported native hook return type encoding");
    }
    signature->result = loader::ffi::resolveType(resultName);
    for (NSUInteger index = 0; index < methodSignature.numberOfArguments; index++)
    {
        std::string name = nativeFFITypeName([methodSignature getArgumentTypeAtIndex:index]);
        if (name.empty())
        {
            throw JSError(runtime, "Unsupported native hook argument type encoding");
        }
        signature->arguments.push_back(loader::ffi::resolveType(name));
    }
    signature->interface = loader::ffi::callInterface(signature->result, signature->arguments);

    Object handlers    = args[2].asObject(runtime);
    auto   functionFor = [&](const char *name) -> std::shared_ptr<Function> {
        Value value = handlers.getProperty(runtime, name);
        if (value.isUndefined() || value.isNull())
        {
            return nullptr;
        }
        if (!value.isObject() || !value.asObject(runtime).isFunction(runtime))
        {
            throw JSError(runtime, "Native hook handlers must be functions");
        }
        return std::make_shared<Function>(value.asObject(runtime).getFunction(runtime));
    };

    std::shared_ptr<Function>   before  = functionFor("before");
    std::shared_ptr<Function>   after   = functionFor("after");
    std::shared_ptr<Function>   replace = functionFor("replace");
    loader::native::HookFlags   flags;
    loader::native::HookPayload payload;
    id                          instanceTarget = nil;
    if (count > 3 && args[3].isObject())
    {
        Object options      = args[3].asObject(runtime);
        flags               = loader::native::parseHookFlags(runtime, options);
        Value instanceValue = options.getProperty(runtime, "instance");
        if (!instanceValue.isUndefined() && !instanceValue.isNull())
        {
            instanceTarget = objcValue(runtime, instanceValue);
            if (!instanceTarget)
            {
                throw JSError(runtime, "Native hook instance target must be an Objective-C handle");
            }
        }
        payload =
            loader::native::parseHookPayload(runtime, options, signature->arguments.size() - 2);
    }
    if (!before && !after && !replace && !flags.cacheOnly)
    {
        throw JSError(runtime, "objc.hook requires at least one handler");
    }
    loader::native::validateHookHandlers(runtime,
                                         {before != nullptr, after != nullptr, replace != nullptr},
                                         flags, payload, signature->result.name);

    std::shared_ptr<HookDispatcher> dispatcher;
    std::string                     key = hookKey(cls, selector);
    {
        std::lock_guard<std::mutex> lock(gHookMutex);
        auto                        iterator = gDispatchers.find(key);
        if (iterator == gDispatchers.end())
        {
            dispatcher            = std::make_shared<HookDispatcher>();
            dispatcher->cls       = cls;
            dispatcher->selector  = selector;
            dispatcher->signature = signature;
            auto prepareClosure   = [&]() -> bool {
                dispatcher->closure =
                    (ffi_closure *) ffi_closure_alloc(sizeof(ffi_closure), &dispatcher->code);
                bool closureReady =
                    dispatcher->closure && isExecutableAddress(dispatcher->code) &&
                    ffi_prep_closure_loc(dispatcher->closure,
                                         &dispatcher->signature->interface->cif, dispatchFFIHook,
                                         dispatcher.get(), dispatcher->code) == FFI_OK;
                if (!closureReady)
                {
                    if (dispatcher->closure)
                        ffi_closure_free(dispatcher->closure);
                    dispatcher->closure = nullptr;
                    dispatcher->code    = nullptr;
                }
                return closureReady;
            };
            if (!prepareClosure())
            {
                dispatcher->code = fallbackHookCode(dispatcher.get());
                if (!dispatcher->code)
                {
                    std::string signatureName = dispatcher->signature->result.name + "(";
                    for (size_t index = 0; index < dispatcher->signature->arguments.size(); index++)
                    {
                        if (index > 0)
                            signatureName += ",";
                        signatureName += dispatcher->signature->arguments[index].name;
                    }
                    signatureName += ")";
                    throw JSError(runtime,
                                  "Native hook closure is unavailable on this device for " +
                                      signatureName);
                }
            }
            gClosureDispatchers[dispatcher.get()] = dispatcher;
            MSHookMessageEx(cls, selector, (IMP) dispatcher->code, &dispatcher->original);
            gDispatchers[key] = dispatcher;
        }
        else
        {
            dispatcher = iterator->second;
            if (dispatcher->signature->result.name != signature->result.name ||
                dispatcher->signature->arguments.size() != signature->arguments.size())
            {
                throw JSError(runtime, "Native hook signature changed while hooks are active");
            }
            if (method_getImplementation(method) == dispatcher->original)
            {
                MSHookMessageEx(cls, selector, (IMP) dispatcher->code, &dispatcher->original);
            }
            dispatcher->retired.store(false);
        }
    }

    auto callbacks             = std::make_shared<HookCallbacks>();
    callbacks->before          = std::move(before);
    callbacks->after           = std::move(after);
    callbacks->replace         = std::move(replace);
    auto state                 = std::make_shared<HookState>();
    state->identifier          = loader::native::nextHookIdentifier();
    state->runtimeGeneration   = loader::native::runtimeGeneration();
    state->callbackResourceKey = loader::native::hookCallbackKey(loader::native::kIOSHookPlatform,
                                                                 std::to_string(state->identifier));
    auto callbackResources     = loader::native::runtimeResourceRegistry(runtime);
    state->callbackResources   = callbackResources;
    state->callbackRuntimeIdentity = callbackResources->identity();
    state->callbacks               = callbacks;
    loader::native::retainRuntimeResource(runtime, state->callbackResourceKey, callbacks);
    state->hasBefore =
        callbacks->before != nullptr && payload.phase != loader::native::HookPayloadPhase::after;
    state->hasAfter =
        callbacks->after != nullptr && payload.phase != loader::native::HookPayloadPhase::before;
    state->hasReplace     = callbacks->replace != nullptr;
    state->cacheOnly      = flags.cacheOnly;
    state->coalesceAfter  = flags.coalesceAfter;
    state->once           = flags.once;
    state->payload        = std::move(payload);
    state->instanceTarget = instanceTarget;
    state->dispatcher     = dispatcher;
    state->inlineRuntime  = loader::native::currentUIScopeRuntime();
    state->addon          = loader::currentAddon();
    {
        std::lock_guard<std::mutex> lock(gHookMutex);
        dispatcher->hooks.push_back(state);
    }
    reservation.commit();
    return Object::createFromHostObject(runtime, std::make_shared<HookTokenHost>(state));
}
}
