#include "NativePluginBridge.h"

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

#include "AndroidFabricAdapter.h"
#include "AndroidHookListeners.h"
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
#include "NativePluginRoot.h"
#include "NativeResourceBudget.h"
#include "NativeRuntimeResources.h"
#include "NativeTaggedValue.h"
#include "NativeTraversalOptions.h"
#include "NativeUIScope.h"

namespace unbound::android {
namespace jsi = facebook::jsi;

using BridgeHandler = std::function<jsi::Value(jsi::Runtime &, const jsi::Value *, size_t)>;

static void define(jsi::Runtime &runtime, jsi::Object &target, const char *name,
                   unsigned int argumentCount, BridgeHandler handler)
{
    target.setProperty(
        runtime, name,
        loader::native::makeFunction(
            runtime, name, argumentCount,
            [handler = std::move(handler)](jsi::Runtime     &rt, const jsi::Value &,
                                           const jsi::Value *args, size_t count) -> jsi::Value {
                return handler(rt, args, count);
            }));
}

static void requireArguments(size_t count, size_t minimum, const char *message)
{
    if (count < minimum)
    {
        throw std::invalid_argument(message);
    }
}

static jsi::Object makeJavaNamespace(jsi::Runtime &runtime, const JavaCallbacks &callbacks)
{
    jsi::Object java(runtime);
    define(runtime, java, "getClass", 1,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               requireArguments(count, 1, "Java class lookup requires a class name");
               return javaSynchronously(rt, callbacks, callbacks.javaGetClass,
                                        {javaName(rt, args[0])});
           });
    define(runtime, java, "className", 1,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               requireArguments(count, 1, "Java class names require a handle");
               return javaSynchronously(rt, callbacks, callbacks.javaClassName,
                                        {serializeJavaHandle(rt, args[0])});
           });
    define(runtime, java, "describe", 1,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               requireArguments(count, 1, "Java class descriptions require a class name");
               return javaSynchronously(rt, callbacks, callbacks.javaDescribe,
                                        {javaName(rt, args[0])});
           });
    define(runtime, java, "construct", 2,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               requireArguments(count, 1, "Java construction requires a class name");
               return javaSynchronously(
                   rt, callbacks, callbacks.javaConstruct,
                   {javaName(rt, args[0]), serializeJavaArguments(rt, args, count, 1)});
           });
    define(runtime, java, "respondsTo", 3,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               requireArguments(count, 2, "Java method probes require a handle and a method name");
               return javaSynchronously(rt, callbacks, callbacks.javaRespondsTo,
                                        {serializeJavaHandle(rt, args[0]), javaName(rt, args[1]),
                                         serializeJavaArguments(rt, args, count, 2)});
           });
    define(runtime, java, "invoke", 3,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               requireArguments(count, 2, "Java invocation requires a handle and a method name");
               return javaSynchronously(rt, callbacks, callbacks.javaInvoke,
                                        {serializeJavaHandle(rt, args[0]), javaName(rt, args[1]),
                                         serializeJavaArguments(rt, args, count, 2)});
           });
    define(runtime, java, "invokeAsync", 3,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               requireArguments(count, 2, "Java invocation requires a handle and a method name");
               std::vector<std::string> arguments{serializeJavaHandle(rt, args[0]),
                                                  javaName(rt, args[1]),
                                                  serializeJavaArguments(rt, args, count, 2)};
               return javaAsynchronously(
                   rt, callbacks, [callbacks, arguments = std::move(arguments)]() {
                       return callJavaString(callbacks, callbacks.javaInvoke, arguments);
                   });
           });
    define(runtime, java, "prepare", 3,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               requireArguments(count, 3,
                                "Prepared Java calls require a handle, method and signature");
               return javaSynchronously(rt, callbacks, callbacks.javaPrepare,
                                        {serializeJavaHandle(rt, args[0]), javaName(rt, args[1]),
                                         serializeJavaParameterTypes(rt, args[2])});
           });
    define(runtime, java, "invokePrepared", 3,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               requireArguments(count, 2, "Prepared Java invocation requires a plan and target");
               return javaSynchronously(rt, callbacks, callbacks.javaInvokePrepared,
                                        {serializeJavaHandle(rt, args[0]),
                                         serializeJavaHandle(rt, args[1]),
                                         serializeJavaArguments(rt, args, count, 2)});
           });
    define(runtime, java, "invokePreparedAsync", 3,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               requireArguments(count, 2, "Prepared Java invocation requires a plan and target");
               std::vector<std::string> arguments{serializeJavaHandle(rt, args[0]),
                                                  serializeJavaHandle(rt, args[1]),
                                                  serializeJavaArguments(rt, args, count, 2)};
               return javaAsynchronously(
                   rt, callbacks, [callbacks, arguments = std::move(arguments)]() {
                       return callJavaString(callbacks, callbacks.javaInvokePrepared, arguments);
                   });
           });
    define(runtime, java, "disposePlan", 1,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               requireArguments(count, 1, "Prepared Java plan disposal requires a call plan");
               callJavaVoid(callbacks, callbacks.javaDisposePlan,
                            {serializeJavaHandle(rt, args[0])});
               return jsi::Value::undefined();
           });
    define(runtime, java, "getField", 2,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               requireArguments(count, 2, "Java field reads require a handle and a field name");
               return javaSynchronously(rt, callbacks, callbacks.javaGetField,
                                        {serializeJavaHandle(rt, args[0]), javaName(rt, args[1])});
           });
    define(runtime, java, "setField", 3,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               requireArguments(count, 3,
                                "Java field writes require a handle, a field name and a value");
               callJavaVoid(callbacks, callbacks.javaSetField,
                            {serializeJavaHandle(rt, args[0]), javaName(rt, args[1]),
                             serializeJavaValue(rt, args[2])});
               return jsi::Value::undefined();
           });
    define(runtime, java, "release", 1,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               requireArguments(count, 1, "Java handle release requires a handle");
               callJavaVoid(callbacks, callbacks.javaRelease, {serializeJavaHandle(rt, args[0])});
               return jsi::Value::undefined();
           });
    define(runtime, java, "batch", 1,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               requireArguments(count, 1, "A Java batch requires an operation list");
               return parseJavaResult(rt, callJavaString(callbacks, callbacks.javaBatch,
                                                         {serializeJavaBatch(rt, args[0])}));
           });
    define(runtime, java, "batchAsync", 1,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               requireArguments(count, 1, "A Java batch requires an operation list");
               std::vector<std::string> arguments{serializeJavaBatch(rt, args[0])};
               return javaAsynchronously(
                   rt, callbacks, [callbacks, arguments = std::move(arguments)]() {
                       return callJavaString(callbacks, callbacks.javaBatch, arguments);
                   });
           });
    define(runtime, java, "findViews", 3,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               requireArguments(count, 2, "A Java view search requires a view and a class name");
               const jsi::Value none;
               const auto       options = loader::native::parseTraversalOptions(
                   rt, count > 2 ? args[2] : none, loader::native::TraversalProfile::Search);
               nlohmann::json normalized = {
                   {"maxDepth", options.maxDepth},
                   {"maxNodes", options.maxNodes},
                   {"maxResults", options.maxResults},
                   {"attachedOnly", options.attachedOnly},
                   {"stopAtMatch", options.stopAtMatch},
                   {"direction", options.direction == loader::native::TraversalDirection::Ancestors
                                     ? "ancestors"
                                     : "descendants"},
               };
               std::vector<std::string> arguments{serializeJavaHandle(rt, args[0]),
                                                  javaName(rt, args[1]), normalized.dump()};
               return javaAsynchronously(
                   rt, callbacks, [callbacks, arguments = std::move(arguments)]() {
                       return callJavaString(callbacks, callbacks.javaFindViews, arguments);
                   });
           });
    define(runtime, java, "createAssociationKey", 0,
           [callbacks](jsi::Runtime &rt, const jsi::Value *, size_t) {
               return parseJavaResult(rt, invokeStaticString(callbacks.bridgeClass,
                                                             callbacks.javaCreateAssociationKey));
           });
    define(runtime, java, "getAssociatedObject", 2,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               requireArguments(count, 2, "Reading an association requires a handle and a key");
               return parseJavaResult(rt,
                                      callJavaString(callbacks, callbacks.javaGetAssociatedObject,
                                                     {serializeJavaHandle(rt, args[0]),
                                                      serializeJavaHandle(rt, args[1])}));
           });
    define(runtime, java, "setAssociatedObject", 3,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               requireArguments(count, 3,
                                "Writing an association requires a handle, a key and a value");
               callSetAssociatedObject(callbacks, serializeJavaHandle(rt, args[0]),
                                       serializeJavaHandle(rt, args[1]),
                                       serializeJavaValue(rt, args[2]));
               return jsi::Value::undefined();
           });
    return java;
}

static jsi::Object makeFFINamespace(jsi::Runtime &runtime)
{
    jsi::Object ffi(runtime);
    define(runtime, ffi, "symbol", 2, [](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
        return loader::ffi::lookupSymbol(rt, args, count);
    });
    define(runtime, ffi, "call", 3, [](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
        return loader::ffi::callFunction(rt, args, count);
    });
    return ffi;
}

static void removeHook(const JavaCallbacks &callbacks, const std::string &token)
{
    forgetHookListener(token);
    hookReturnValues().clear(token);
    installedHooks().release(token);
    callJavaVoid(callbacks, callbacks.hooksRemove, {loader::native::handleJSON(token)});
}

static jsi::Object makeHooksNamespace(jsi::Runtime &runtime, const JavaCallbacks &callbacks)
{
    jsi::Object hooks(runtime);
    define(
        runtime, hooks, "hook", 5,
        [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
            requireArguments(count, 3,
                             "Hooks require a class name, a method name and parameter types");
            std::string parameters = serializeJavaArguments(rt, args, count, 2);
            std::string options  = count > 3 && args[3].isObject() ? serializeJavaValue(rt, args[3])
                                                                   : std::string("{}");
            bool        coalesce = false;
            if (count > 3 && args[3].isObject())
            {
                jsi::Value value = args[3].asObject(rt).getProperty(rt, "coalesce");
                if (!value.isUndefined() && !value.isNull())
                {
                    if (!value.isString() || javaName(rt, value) != "receiver")
                    {
                        throw std::invalid_argument("Hook coalescing must be set to receiver");
                    }
                    coalesce = true;
                }
            }
            if (coalesce &&
                (count <= 4 || !args[4].isObject() || !args[4].asObject(rt).isFunction(rt)))
            {
                throw std::invalid_argument("Receiver coalescing requires an observation callback");
            }
            jsi::Value rewriteOption =
                count > 3 && args[3].isObject()
                    ? args[3].asObject(rt).getProperty(rt, "rewriteArguments")
                    : jsi::Value::undefined();
            bool rewritesArguments = rewriteOption.isBool() && rewriteOption.getBool();
            if (rewritesArguments &&
                (count <= 4 || !args[4].isObject() || !args[4].asObject(rt).isFunction(rt) ||
                 !loader::native::currentUIScopeRuntime()))
            {
                throw std::invalid_argument(
                    "Rewriting arguments requires a callback hooked from a UI scope");
            }
            loader::native::NativeResourceReservation reservation(
                loader::native::nativeHookBudget(), "Too many native hooks are installed");
            std::string token =
                callJavaString(callbacks, callbacks.hooksInstall,
                               {javaName(rt, args[0]), javaName(rt, args[1]), parameters, options});

            nlohmann::json parsed = nlohmann::json::parse(token, nullptr, false);
            if (parsed.is_discarded() || !parsed.contains("id") || !parsed["id"].is_string())
            {
                throw std::runtime_error("The Android hook adapter returned no token");
            }
            installedHooks().adopt(parsed["id"].get<std::string>(), reservation);
            if (count > 4)
            {
                rememberHookListener(rt, parsed["id"].get<std::string>(), args[4], coalesce,
                                     rewritesArguments, callbacks);
            }
            return loader::toJSIValue(rt, parsed);
        });
    define(runtime, hooks, "remove", 1,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               requireArguments(count, 1, "Removing a hook requires its token");
               removeHook(callbacks, hookTokenId(rt, args[0]));
               return jsi::Value::undefined();
           });
    define(runtime, hooks, "setReturnValue", 4,
           [](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               requireArguments(
                   count, 4,
                   "A cached hook result requires a token, a receiver, arguments and a value");
               std::string token = installedHookToken(rt, args[0]);
               hookReturnValues().set(token, boundedJSON(rt, args[1]),
                                      boundedArgumentsJSON(rt, args[2]), boundedJSON(rt, args[3]));
               return jsi::Value::undefined();
           });
    define(runtime, hooks, "removeReturnValue", 3,
           [](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               requireArguments(
                   count, 3,
                   "Removing a cached hook result requires a token, a receiver and arguments");
               hookReturnValues().remove(hookTokenId(rt, args[0]), boundedJSON(rt, args[1]),
                                         boundedArgumentsJSON(rt, args[2]));
               return jsi::Value::undefined();
           });
    define(runtime, hooks, "clearReturnValues", 1,
           [](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               requireArguments(count, 1, "Clearing cached hook results requires a token");
               hookReturnValues().clear(hookTokenId(rt, args[0]));
               return jsi::Value::undefined();
           });
    return hooks;
}

static jsi::Object makeDebugNamespace(jsi::Runtime &runtime, const JavaCallbacks &callbacks)
{
    jsi::Object debug(runtime);
    debug.setProperty(runtime, "recordEvaluation",
                      loader::native::makeRecordEvaluationFunction(runtime));
    define(runtime, debug, "environment", 0,
           [](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               return loader::native::readDebugEnvironment(rt, args, count);
           });
    return debug;
}

// Android scopes name full paths (`java.invoke`, `hooks.hook`) and never allow `*Async` methods.
static bool scopeAllows(const loader::native::UIScope &scope, const std::string &path)
{
    if (path.size() > 5 && path.compare(path.size() - 5, 5, "Async") == 0)
    {
        return false;
    }
    return scope.allows(path);
}

static jsi::Object filterNamespace(jsi::Runtime &runtime, jsi::Object source,
                                   const loader::native::UIScope &scope, const std::string &prefix)
{
    jsi::Object filtered(runtime);
    jsi::Array  names = source.getPropertyNames(runtime);
    for (size_t index = 0; index < names.size(runtime); index++)
    {
        std::string name = names.getValueAtIndex(runtime, index).getString(runtime).utf8(runtime);
        if (scopeAllows(scope, prefix + name))
        {
            filtered.setProperty(runtime, name.c_str(), source.getProperty(runtime, name.c_str()));
        }
    }
    return filtered;
}

static jsi::Object makeScopedHooks(jsi::Runtime                                   &runtime,
                                   const std::shared_ptr<loader::native::UIScope> &scope,
                                   const JavaCallbacks                            &callbacks)
{
    jsi::Object hooks =
        filterNamespace(runtime, makeHooksNamespace(runtime, callbacks), *scope, "hooks.");
    if (!hooks.hasProperty(runtime, "hook"))
    {
        return hooks;
    }
    auto install = std::make_shared<jsi::Function>(hooks.getPropertyAsFunction(runtime, "hook"));
    define(runtime, hooks, "hook", 5,
           [scope, install, callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               return scope->hook(rt,
                                  [&]() -> std::pair<jsi::Value, loader::native::UIScope::Release> {
                                      jsi::Value  token = install->call(rt, args, count);
                                      std::string id    = hookTokenId(rt, token);
                                      return {std::move(token), [callbacks, id] {
                                                  if (installedHooks().contains(id))
                                                  {
                                                      removeHook(callbacks, id);
                                                  }
                                              }};
                                  });
           });
    return hooks;
}

struct UIRuntimeRecord {
    jsi::Runtime                                          *runtime = nullptr;
    std::weak_ptr<loader::native::RuntimeResourceRegistry> resources;
    uint64_t                                               identity = 0;
};

static std::mutex      gUIRuntimeMutex;
static UIRuntimeRecord gUIRuntime;

static void rememberUIRuntime(jsi::Runtime &runtime)
{
    if (!onMainThread())
    {
        return;
    }
    {
        std::lock_guard<std::mutex> lock(gUIRuntimeMutex);
        if (gUIRuntime.runtime == &runtime && !gUIRuntime.resources.expired())
        {
            return;
        }
    }
    auto                        resources = loader::native::runtimeResourceRegistry(runtime);
    std::lock_guard<std::mutex> lock(gUIRuntimeMutex);
    gUIRuntime = {&runtime, resources, resources->identity()};
}

static bool collectUIRuntimeGarbage()
{
    UIRuntimeRecord record;
    {
        std::lock_guard<std::mutex> lock(gUIRuntimeMutex);
        record = gUIRuntime;
    }
    if (!record.runtime)
    {
        return false;
    }
    bool collected = false;
    loader::native::executeMainSynchronouslyUnlessMainWaits([&] {
        collected = loader::native::withRuntimeResource(
            record.resources, record.identity, [&](loader::native::RuntimeResourceRegistry &) {
                record.runtime->instrumentation().collectGarbage("unbound debug");
            });
    });
    return collected;
}

static jsi::Value createUIScope(jsi::Runtime &runtime, const JavaCallbacks &callbacks,
                                const jsi::Value *args, size_t count)
{
    std::vector<std::string> allowed = loader::native::parseUIScopePaths(
        runtime, args, count, "java.createUIScope expects the method paths the scope may use", "");
    auto scope =
        std::make_shared<loader::native::UIScope>(loader::currentAddon(), std::move(allowed));
    return loader::native::makeUIScopeObject(
        runtime, scope, {"java", "hooks"},
        [scope, callbacks](jsi::Runtime &rt, const std::string &name) {
            return name == "java"
                       ? filterNamespace(rt, makeJavaNamespace(rt, callbacks), *scope, "java.")
                       : makeScopedHooks(rt, scope, callbacks);
        },
        rememberUIRuntime);
}

void registerNativePluginBridge(jsi::Runtime &runtime, const JavaCallbacks &callbacks)
{
    watchRuntimeGenerations(callbacks);
    leaseJavaHandles(callbacks);
    loader::native::setPlatformResourceCounter(loader::native::kJavaHandleCounter, [callbacks] {
        std::optional<jint> live = callStaticInt(callbacks.bridgeClass, callbacks.javaLiveHandles);
        return live && *live > 0 ? static_cast<size_t>(*live) : 0;
    });
    loader::native::setUIRuntimeGarbageCollector(collectUIRuntimeGarbage);

    loader::native::NativePluginRootBuilder bridge(runtime,
                                                   loader::native::NativePluginPlatform::Android);
    jsi::Object                             java = makeJavaNamespace(runtime, callbacks);
    define(runtime, java, "createUIScope", 1,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               return createUIScope(rt, callbacks, args, count);
           });
    bridge.addNamespace("java", std::move(java));
    bridge.addNamespace("ffi", makeFFINamespace(runtime));
    bridge.addNamespace("hooks", makeHooksNamespace(runtime, callbacks));
    bridge.addNamespace("debug", makeDebugNamespace(runtime, callbacks));
    bridge.addNamespace(
        "fabric", loader::native::makeFabricNamespace(runtime, makeAndroidFabricAdapter(callbacks),
                                                      loader::native::FabricCalls::AsyncOnly));
    bridge.install();
}
}
