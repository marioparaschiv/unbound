#import "NativePluginBridge.h"

#import <Foundation/Foundation.h>
#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include <utility>
#include <vector>

#import "LoaderAddonActivity.h"
#import "LoaderJSIJSON.h"
#import "NativeEvaluations.h"
#import "NativeFFI.h"
#import "NativeFabric.h"
#import "NativePlatformBridge.h"
#import "NativePluginAssociations.h"
#import "NativePluginBatch.h"
#import "NativePluginCallPlans.h"
#import "NativePluginFFICodecs.h"
#import "NativePluginFabricAdapter.h"
#import "NativePluginHooks.h"
#import "NativePluginInvocation.h"
#import "NativePluginIvars.h"
#import "NativePluginObjCValues.h"
#import "NativePluginRoot.h"
#import "NativePluginRuntime.h"
#import "NativePluginSuperCalls.h"
#import "NativePluginThreading.h"
#import "NativePluginUITraversal.h"
#import "NativeResourceBudget.h"
#import "NativeRuntimeResources.h"
#import "NativeUIScope.h"

using namespace facebook;
using namespace facebook::jsi;

namespace loader::ios {
static Value makeFunction(const char *name, unsigned int argCount, Runtime &runtime,
                          const HostFunctionType &handler)
{
    HostFunctionType translated = [handler](Runtime &rt, const Value &thisValue, const Value *args,
                                            size_t count) -> Value {
        @try
        {
            return handler(rt, thisValue, args, count);
        }
        @catch (NSException *exception)
        {
            throw loader::native::NativeCodedError("NATIVE_BRIDGE_ERROR",
                                                   std::string("Objective-C exception: ") +
                                                       (exception.reason.UTF8String ?: "unknown"));
        }
    };
    return loader::native::makeFunction(runtime, name, argCount, std::move(translated));
}

static Value makeFunction(const char *name, unsigned int argCount, Runtime &runtime,
                          Value (*handler)(Runtime &, const Value *, size_t))
{
    HostFunctionType wrappedHandler = [handler](Runtime &rt, const Value &, const Value *args,
                                                size_t count) -> Value {
        return handler(rt, args, count);
    };
    return makeFunction(name, argCount, runtime, wrappedHandler);
}

static void installObjC(Runtime &runtime, Object &objc);

// iOS scopes name `objc.` paths and keep them without the prefix.
static Object makeScopedObjC(Runtime                                        &runtime,
                             const std::shared_ptr<loader::native::UIScope> &scope)
{
    Object full(runtime);
    installObjC(runtime, full);
    Object scoped(runtime);
    for (const std::string &allowed : scope->allowed())
    {
        if (allowed == "hook")
        {
            scoped.setProperty(
                runtime, "hook",
                makeFunction(
                    "hook", 3, runtime,
                    [scope](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                        return scope->hook(
                            rt, [&]() -> std::pair<Value, loader::native::UIScope::Release> {
                                Value token = makeHook(rt, args, count);
                                if (!token.isObject() ||
                                    !token.asObject(rt).isHostObject<HookTokenHost>(rt))
                                {
                                    return {std::move(token), nullptr};
                                }
                                std::shared_ptr<HookState> state =
                                    token.asObject(rt).getHostObject<HookTokenHost>(rt)->state();
                                return {std::move(token), [state] {
                                            removeHook(state);
                                        }};
                            });
                    }));
            continue;
        }
        Value value = full.getProperty(runtime, allowed.c_str());
        if (!value.isUndefined())
        {
            scoped.setProperty(runtime, allowed.c_str(), std::move(value));
        }
    }
    return scoped;
}

static Value createUIScope(Runtime &runtime, const Value *args, size_t count)
{
    std::vector<std::string> allowed = loader::native::parseUIScopePaths(
        runtime, args, count, "objc.createUIScope expects the method paths the scope may use",
        "objc.");
    auto scope =
        std::make_shared<loader::native::UIScope>(loader::currentAddon(), std::move(allowed));
    return loader::native::makeUIScopeObject(runtime, scope, {"objc"},
                                             [scope](Runtime &rt, const std::string &) {
                                                 return makeScopedObjC(rt, scope);
                                             });
}

static void installObjC(Runtime &runtime, Object &objc)
{
    objc.setProperty(
        runtime, "getClass",
        makeFunction("getClass", 1, runtime,
                     [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                         if (count == 0 || !args[0].isString())
                         {
                             return Value::null();
                         }
                         Class cls = NSClassFromString(jsiString(rt, args[0]));
                         return cls ? Object::createFromHostObject(
                                          rt, std::make_shared<ObjCHandleHost>((id) cls))
                                    : Value::null();
                     }));

    objc.setProperty(
        runtime, "alloc",
        makeFunction("alloc", 1, runtime,
                     [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                         Class cls = count ? classFromValue(rt, args[0]) : Nil;
                         if (!cls)
                         {
                             throw JSError(rt, "objc.alloc expects a class handle or class name");
                         }
                         return objcHandleResult(rt, [[cls alloc] init]);
                     }));

    objc.setProperty(
        runtime, "className",
        makeFunction("className", 1, runtime,
                     [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                         id object = count ? objcValue(rt, args[0]) : nil;
                         if (!object)
                         {
                             return Value::null();
                         }
                         Class cls = object_isClass(object) ? object : object_getClass(object);
                         return objcJSIValue(rt, NSStringFromClass(cls));
                     }));

    objc.setProperty(
        runtime, "respondsTo",
        makeFunction("respondsTo", 2, runtime,
                     [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                         if (count < 2)
                         {
                             return Value(false);
                         }
                         id        object = objcValue(rt, args[0]);
                         NSString *name   = jsiString(rt, args[1]);
                         return Value(object &&
                                      [object respondsToSelector:NSSelectorFromString(name)]);
                     }));

    objc.setProperty(
        runtime, "call",
        makeFunction("call", 2, runtime,
                     [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                         if (count < 2)
                         {
                             throw JSError(rt, "objc.call expects an object handle and selector");
                         }
                         return objcFunction(rt, args[0], args[1], args, count, 2);
                     }));

    objc.setProperty(
        runtime, "callSuper",
        makeFunction(
            "callSuper", 3, runtime,
            [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                if (count < 3)
                {
                    throw JSError(rt, "objc.callSuper expects an object, class, and selector");
                }
                id        object       = objcValue(rt, args[0]);
                Class     cls          = classFromValue(rt, args[1]);
                NSString *selectorName = jsiString(rt, args[2]);
                return invokeSuperObject(rt, object, cls, NSSelectorFromString(selectorName),
                                         argumentArray(rt, args, count, 3));
            }));

    objc.setProperty(
        runtime, "invoke",
        makeFunction(
            "invoke", 3, runtime,
            [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                if (count < 3 || !args[2].isObject() || !args[2].asObject(rt).isArray(rt))
                {
                    throw JSError(rt,
                                  "objc.invoke expects an object, selector, and argument array");
                }
                Array           array     = args[2].asObject(rt).asArray(rt);
                NSMutableArray *arguments = [NSMutableArray arrayWithCapacity:array.size(rt)];
                for (size_t index = 0; index < array.size(rt); index++)
                {
                    [arguments addObject:valueToObjC(rt, array.getValueAtIndex(rt, index))
                                             ?: [NSNull null]];
                }
                id        object       = objcValue(rt, args[0]);
                NSString *selectorName = jsiString(rt, args[1]);
                return invokeWithThreadPolicy(rt, object, NSSelectorFromString(selectorName),
                                              arguments, count > 3 ? &args[3] : nullptr);
            }));

    objc.setProperty(
        runtime, "prepare",
        makeFunction("prepare", 2, runtime,
                     [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                         if (count < 2)
                         {
                             throw JSError(rt, "objc.prepare expects an object and selector");
                         }
                         id        target       = objcValue(rt, args[0]);
                         NSString *selectorName = jsiString(rt, args[1]);
                         auto      plan =
                             prepareObjCCallPlan(rt, target, NSSelectorFromString(selectorName));
                         return Object::createFromHostObject(rt, std::move(plan));
                     }));

    objc.setProperty(
        runtime, "invokePrepared",
        makeFunction(
            "invokePrepared", 3, runtime,
            [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                if (count < 3 || !args[2].isObject() || !args[2].asObject(rt).isArray(rt))
                {
                    throw JSError(rt,
                                  "objc.invokePrepared expects a plan, target, and argument array");
                }
                auto plan   = objcCallPlanHost(rt, args[0]);
                id   target = objcValue(rt, args[1]);
                plan->validate(rt, target);
                Array           array      = args[2].asObject(rt).asArray(rt);
                NSMutableArray *arguments  = argumentArray(rt, array);
                NSInvocation   *invocation = prepareInvocationWithSignature(
                    target, plan->selector(), arguments, plan->signature(), &plan->argumentTypes());
                return invokeInvocationWithThreadPolicy(
                    rt, invocation, count > 3 ? &args[3] : nullptr, &plan->resultType());
            }));

    objc.setProperty(
        runtime, "invokePreparedAsync",
        makeFunction(
            "invokePreparedAsync", 3, runtime,
            [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                if (count < 3 || !args[2].isObject() || !args[2].asObject(rt).isArray(rt))
                {
                    throw JSError(
                        rt, "objc.invokePreparedAsync expects a plan, target, and argument array");
                }
                auto plan   = objcCallPlanHost(rt, args[0]);
                id   target = objcValue(rt, args[1]);
                plan->validate(rt, target);
                Array           array      = args[2].asObject(rt).asArray(rt);
                NSMutableArray *arguments  = argumentArray(rt, array);
                NSInvocation   *invocation = prepareInvocationWithSignature(
                    target, plan->selector(), arguments, plan->signature(), &plan->argumentTypes());
                return invokeInvocationAsync(rt, invocation, plan);
            }));

    objc.setProperty(
        runtime, "disposePlan",
        makeFunction("disposePlan", 1, runtime,
                     [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                         if (count < 1)
                         {
                             throw JSError(rt, "objc.disposePlan expects a call plan");
                         }
                         objcCallPlanHost(rt, args[0])->dispose();
                         return Value::undefined();
                     }));

    objc.setProperty(
        runtime, "invokeAsync",
        makeFunction(
            "invokeAsync", 3, runtime,
            [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                if (count < 3 || !args[2].isObject() || !args[2].asObject(rt).isArray(rt))
                {
                    throw JSError(
                        rt, "objc.invokeAsync expects an object, selector, and argument array");
                }
                Array           array     = args[2].asObject(rt).asArray(rt);
                NSMutableArray *arguments = [NSMutableArray arrayWithCapacity:array.size(rt)];
                for (size_t index = 0; index < array.size(rt); index++)
                {
                    [arguments addObject:valueToObjC(rt, array.getValueAtIndex(rt, index))
                                             ?: [NSNull null]];
                }
                id        object       = objcValue(rt, args[0]);
                NSString *selectorName = jsiString(rt, args[1]);
                return invokeAsync(rt, object, NSSelectorFromString(selectorName), arguments);
            }));

    objc.setProperty(runtime, "batch", makeFunction("batch", 1, runtime, invokeBatch));
    objc.setProperty(runtime, "snapshot", makeFunction("snapshot", 2, runtime, snapshotUI));
    objc.setProperty(runtime, "findViews", makeFunction("findViews", 3, runtime, findUIViews));

    objc.setProperty(
        runtime, "invokeSuper",
        makeFunction(
            "invokeSuper", 4, runtime,
            [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                if (count < 4 || !args[3].isObject() || !args[3].asObject(rt).isArray(rt))
                {
                    throw JSError(
                        rt,
                        "objc.invokeSuper expects an object, class, selector, and argument array");
                }
                id              object       = objcValue(rt, args[0]);
                Class           cls          = classFromValue(rt, args[1]);
                NSString       *selectorName = jsiString(rt, args[2]);
                Array           array        = args[3].asObject(rt).asArray(rt);
                NSMutableArray *arguments    = [NSMutableArray arrayWithCapacity:array.size(rt)];
                for (size_t index = 0; index < array.size(rt); index++)
                {
                    [arguments addObject:valueToObjC(rt, array.getValueAtIndex(rt, index))
                                             ?: [NSNull null]];
                }
                return invokeSuperWithThreadPolicy(rt, object, cls,
                                                   NSSelectorFromString(selectorName), arguments,
                                                   count > 4 ? &args[4] : nullptr);
            }));

    objc.setProperty(
        runtime, "invokeSuperAsync",
        makeFunction(
            "invokeSuperAsync", 4, runtime,
            [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                if (count < 4 || !args[3].isObject() || !args[3].asObject(rt).isArray(rt))
                {
                    throw JSError(
                        rt,
                        "objc.invokeSuperAsync expects an object, class, selector, and argument array");
                }
                id              object       = objcValue(rt, args[0]);
                Class           cls          = classFromValue(rt, args[1]);
                NSString       *selectorName = jsiString(rt, args[2]);
                Array           array        = args[3].asObject(rt).asArray(rt);
                NSMutableArray *arguments    = [NSMutableArray arrayWithCapacity:array.size(rt)];
                for (size_t index = 0; index < array.size(rt); index++)
                {
                    [arguments addObject:valueToObjC(rt, array.getValueAtIndex(rt, index))
                                             ?: [NSNull null]];
                }
                return invokeSuperAsync(rt, object, cls, NSSelectorFromString(selectorName),
                                        arguments);
            }));

    objc.setProperty(runtime, "getIvar", makeFunction("getIvar", 2, runtime, getIvar));
    objc.setProperty(runtime, "setIvar", makeFunction("setIvar", 3, runtime, setIvar));

    objc.setProperty(runtime, "createAssociationKey",
                     makeFunction("createAssociationKey", 0, runtime,
                                  [](Runtime &rt, const Value &, const Value *, size_t) -> Value {
                                      return Object::createFromHostObject(
                                          rt, std::make_shared<AssociationKeyHost>([NSObject new]));
                                  }));

    objc.setProperty(
        runtime, "getAssociatedObject",
        makeFunction("getAssociatedObject", 2, runtime,
                     [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                         if (count < 2)
                         {
                             return Value::null();
                         }
                         id object = objcValue(rt, args[0]);
                         if (!args[1].isObject() ||
                             !args[1].asObject(rt).isHostObject<AssociationKeyHost>(rt))
                         {
                             return Value::null();
                         }
                         const void *key =
                             args[1].asObject(rt).getHostObject<AssociationKeyHost>(rt)->key();
                         return objcResult(rt, objc_getAssociatedObject(object, key));
                     }));

    objc.setProperty(
        runtime, "setAssociatedObject",
        makeFunction(
            "setAssociatedObject", 4, runtime,
            [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                if (count < 3 || !args[1].isObject() ||
                    !args[1].asObject(rt).isHostObject<AssociationKeyHost>(rt))
                {
                    throw JSError(rt,
                                  "objc.setAssociatedObject expects an object and association key");
                }
                id          object = objcValue(rt, args[0]);
                const void *key = args[1].asObject(rt).getHostObject<AssociationKeyHost>(rt)->key();
                id          value = valueToObjC(rt, args[2]);
                objc_setAssociatedObject(object, key, value == [NSNull null] ? nil : value,
                                         associationPolicy(rt, count > 3 ? &args[3] : nullptr));
                return Value::undefined();
            }));

    objc.setProperty(
        runtime, "struct",
        makeFunction("struct", 2, runtime,
                     [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                         if (count < 2 || !args[0].isString())
                         {
                             throw JSError(rt, "objc.struct expects a name and fields");
                         }
                         return structValue(rt, jsiString(rt, args[0]), args[1]);
                     }));

    objc.setProperty(
        runtime, "array",
        makeFunction("array", 1, runtime,
                     [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                         id object = count ? objcValue(rt, args[0]) : nil;
                         if (![object isKindOfClass:[NSArray class]])
                         {
                             return Array(rt, 0);
                         }
                         return objcResult(rt, object);
                     }));

    objc.setProperty(
        runtime, "data",
        makeFunction("data", 1, runtime,
                     [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                         NSData *data = count ? valueToData(rt, args[0]) : nil;
                         if (!data)
                         {
                             throw JSError(rt, "objc.data expects an ArrayBuffer or TypedArray");
                         }
                         return objcHandleResult(rt, data);
                     }));

    objc.setProperty(runtime, "hook", makeFunction("hook", 3, runtime, makeHook));
    objc.setProperty(runtime, "createUIScope",
                     makeFunction("createUIScope", 1, runtime, createUIScope));
}

static void installFFI(Runtime &runtime, Object &ffi)
{
    ffi.setProperty(runtime, "symbol",
                    makeFunction("symbol", 2, runtime, loader::ffi::lookupSymbol));
    ffi.setProperty(runtime, "call", makeFunction("call", 3, runtime, loader::ffi::callFunction));
}

static Value environment(Runtime &runtime, const Value *, size_t)
{
    return loader::toJSIValue(runtime, loader::currentDebugEnvironment());
}

static void installDebug(Runtime &runtime, Object &debug)
{
    debug.setProperty(runtime, "recordEvaluation",
                      loader::native::makeRecordEvaluationFunction(runtime));
    debug.setProperty(runtime, "environment", makeFunction("environment", 0, runtime, environment));
}
}

namespace loader {

void setNativePluginFabricHost(id instance)
{
    loader::ios::setNativePluginFabricHost(instance);
}

static void invalidateRuntimeResources(uint64_t generation)
{
    ios::invalidateRuntimeHooks(generation);
}

void registerNativePluginBridge(Runtime &runtime)
{
    ios::installFFIPlatform();
    static std::once_flag invalidation;
    std::call_once(invalidation, [] {
        loader::native::onRuntimeGenerationChanged(invalidateRuntimeResources);
    });
    loader::native::registerRuntime(runtime);
    loader::native::setPlatformResourceCounter(loader::native::kObjCHandleCounter, [] {
        return ios::liveObjCHandles().load();
    });
    loader::native::setPlatformResourceCounter(loader::native::kObjCPlanCounter, [] {
        return loader::native::nativePreparedCallBudget().used();
    });
    loader::native::setPlatformResourceCounter(loader::native::kObjCRetainCounter, [] {
        return ios::liveObjCRetains().load();
    });
    loader::native::NativePluginRootBuilder bridge(runtime,
                                                   loader::native::NativePluginPlatform::IOS);

    Object objc(runtime);
    ios::installObjC(runtime, objc);
    bridge.addNamespace("objc", std::move(objc));

    Object ffi(runtime);
    ios::installFFI(runtime, ffi);
    bridge.addNamespace("ffi", std::move(ffi));

    auto fabricAdapter = loader::ios::makeNativePluginFabricAdapter(
        [](Runtime &rt, const Value &handle) {
            return ios::objcValue(rt, handle);
        },
        [](std::function<void()> operation) {
            ios::objcGuarded(std::move(operation))();
        },
        [](const char *operation, const std::function<void()> &work) {
            ios::NativeOperationSignpost signpost(operation);
            work();
        });
    bridge.addNamespace(
        "fabric", loader::native::makeFabricNamespace(runtime, std::move(fabricAdapter),
                                                      loader::native::FabricCalls::SyncAndAsync));
    loader::ios::observeNativePluginFabricMemoryWarnings();

    Object debug(runtime);
    ios::installDebug(runtime, debug);
    bridge.addNamespace("debug", std::move(debug));

    bridge.install();
}

}
