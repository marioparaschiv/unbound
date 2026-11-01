#include "NativePluginBridge.h"

#include <algorithm>
#include <cmath>
#include <functional>
#include <iterator>
#include <memory>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <string>
#include <sys/types.h>
#include <unistd.h>
#include <unordered_map>
#include <vector>

#include "JniEnvironment.h"
#include "LoaderAddonActivity.h"
#include "LoaderBootstrap.h"
#include "LoaderLog.h"
#include "LoaderThreadWarnings.h"
#include "NativeBoundedValue.h"
#include "NativeEvaluations.h"
#include "NativeFFI.h"
#include "NativeFabric.h"
#include "NativeGeometry.h"
#include "NativeHandleLeases.h"
#include "NativeHookReturnCache.h"
#include "NativeLimits.h"
#include "NativePlatformBridge.h"
#include "NativePluginRoot.h"
#include "NativeResourceBudget.h"
#include "NativeTaggedValue.h"
#include "NativeTraversalOptions.h"

namespace unbound::android {
namespace jsi = facebook::jsi;

static std::string takeJavaFailure(JNIEnv *env, const char *fallback)
{
    jthrowable thrown = env->ExceptionOccurred();
    if (!thrown)
    {
        return fallback;
    }

    env->ExceptionClear();
    jclass      throwableClass = env->GetObjectClass(thrown);
    jmethodID   describe = env->GetMethodID(throwableClass, "toString", "()Ljava/lang/String;");
    std::string message  = fallback;
    if (describe)
    {
        auto described = static_cast<jstring>(env->CallObjectMethod(thrown, describe));
        if (described && !env->ExceptionCheck())
        {
            message = toStdString(env, described);
        }
        if (described)
        {
            env->DeleteLocalRef(described);
        }
        env->ExceptionClear();
    }

    env->DeleteLocalRef(throwableClass);
    env->DeleteLocalRef(thrown);
    return message;
}

static std::string callJavaString(const JavaCallbacks &callbacks, jmethodID method,
                                  const std::vector<std::string> &arguments)
{
    JNIEnv *env = currentEnvironment();
    if (!env || !callbacks.bridgeClass || !method)
    {
        throw std::runtime_error("The Android Java adapter is unavailable");
    }

    if (arguments.empty() || arguments.size() > 4)
    {
        throw std::invalid_argument("unsupported Java adapter arity");
    }

    std::vector<jstring> inputs;
    inputs.reserve(arguments.size());
    for (const std::string &argument : arguments)
    {
        inputs.push_back(toJavaString(env, argument));
    }

    jobject output = nullptr;
    if (inputs.size() == 1)
    {
        output = env->CallStaticObjectMethod(callbacks.bridgeClass, method, inputs[0]);
    }
    else if (inputs.size() == 2)
    {
        output = env->CallStaticObjectMethod(callbacks.bridgeClass, method, inputs[0], inputs[1]);
    }
    else if (inputs.size() == 3)
    {
        output = env->CallStaticObjectMethod(callbacks.bridgeClass, method, inputs[0], inputs[1],
                                             inputs[2]);
    }
    else if (inputs.size() == 4)
    {
        output = env->CallStaticObjectMethod(callbacks.bridgeClass, method, inputs[0], inputs[1],
                                             inputs[2], inputs[3]);
    }

    std::string failure =
        env->ExceptionCheck() ? takeJavaFailure(env, "The Android Java operation failed") : "";
    for (jstring input : inputs)
    {
        env->DeleteLocalRef(input);
    }

    if (!failure.empty() || !output)
    {
        if (output)
        {
            env->DeleteLocalRef(output);
        }
        throw std::runtime_error(failure.empty() ? "The Android Java operation returned nothing"
                                                 : failure);
    }

    std::string result = toStdString(env, static_cast<jstring>(output));
    env->DeleteLocalRef(output);
    return result;
}

static void callJavaVoid(const JavaCallbacks &callbacks, jmethodID method,
                         const std::vector<std::string> &arguments)
{
    JNIEnv *env = currentEnvironment();
    if (!env || !callbacks.bridgeClass || !method)
    {
        throw std::runtime_error("The Android Java adapter is unavailable");
    }

    if (arguments.empty() || arguments.size() > 4)
    {
        throw std::invalid_argument("unsupported Java adapter arity");
    }

    std::vector<jstring> inputs;
    inputs.reserve(arguments.size());
    for (const std::string &argument : arguments)
    {
        inputs.push_back(toJavaString(env, argument));
    }

    if (inputs.size() == 1)
    {
        env->CallStaticVoidMethod(callbacks.bridgeClass, method, inputs[0]);
    }
    else if (inputs.size() == 2)
    {
        env->CallStaticVoidMethod(callbacks.bridgeClass, method, inputs[0], inputs[1]);
    }
    else if (inputs.size() == 3)
    {
        env->CallStaticVoidMethod(callbacks.bridgeClass, method, inputs[0], inputs[1], inputs[2]);
    }
    else if (inputs.size() == 4)
    {
        env->CallStaticVoidMethod(callbacks.bridgeClass, method, inputs[0], inputs[1], inputs[2],
                                  inputs[3]);
    }

    std::string failure =
        env->ExceptionCheck() ? takeJavaFailure(env, "The Android Java operation failed") : "";
    for (jstring input : inputs)
    {
        env->DeleteLocalRef(input);
    }

    if (!failure.empty())
    {
        throw std::runtime_error(failure);
    }
}

static bool callJavaBoolean(const JavaCallbacks &callbacks, jmethodID method,
                            const std::string &argument)
{
    JNIEnv *env = currentEnvironment();
    if (!env || !callbacks.bridgeClass || !method)
    {
        throw std::runtime_error("The Android adapter is unavailable");
    }

    jstring     input  = toJavaString(env, argument);
    jboolean    output = env->CallStaticBooleanMethod(callbacks.bridgeClass, method, input);
    std::string failure =
        env->ExceptionCheck() ? takeJavaFailure(env, "The Android operation failed") : "";
    env->DeleteLocalRef(input);

    if (!failure.empty())
    {
        throw std::runtime_error(failure);
    }

    return output == JNI_TRUE;
}

static std::string callJavaStringNoArguments(const JavaCallbacks &callbacks, jmethodID method)
{
    JNIEnv *env = currentEnvironment();
    if (!env || !callbacks.bridgeClass || !method)
    {
        throw std::runtime_error("The Android debug adapter is unavailable");
    }

    auto output = static_cast<jstring>(env->CallStaticObjectMethod(callbacks.bridgeClass, method));
    std::string failure =
        env->ExceptionCheck() ? takeJavaFailure(env, "The Android debug operation failed") : "";

    if (!failure.empty() || !output)
    {
        if (output)
        {
            env->DeleteLocalRef(output);
        }
        throw std::runtime_error(failure.empty() ? "The Android debug adapter returned nothing"
                                                 : failure);
    }

    std::string result = toStdString(env, output);
    env->DeleteLocalRef(output);
    return result;
}

static std::string javaName(jsi::Runtime &runtime, const jsi::Value &value)
{
    return loader::native::parseName(runtime, value, loader::native::kMaximumNativeNameBytes,
                                     "A Java name");
}

static std::string serializeJavaHandle(jsi::Runtime &runtime, const jsi::Value &value)
{
    return loader::native::handleJSON(
        loader::native::parseHandleId(runtime, value, "A Java handle"));
}

static std::string serializeJavaBatch(jsi::Runtime &runtime, const jsi::Value &value)
{
    nlohmann::json steps =
        loader::native::serializeBoundedBatch(runtime, value, loader::native::kMaximumBatchSteps);
    for (nlohmann::json &step : steps)
    {
        if (!step.is_object() || !step.contains("op") || !step["op"].is_string())
        {
            throw std::invalid_argument("Java batch steps require an operation name");
        }
        const std::string &operation = step["op"].get_ref<const std::string &>();
        if (operation != "invoke" && operation != "getField" && operation != "setField" &&
            operation != "respondsTo")
        {
            throw std::invalid_argument("Unsupported Java batch operation: " + operation);
        }
        step["handle"] = {
            {"id", loader::native::parseHandleId(step.value("handle", nlohmann::json()),
                                                 "A Java batch handle")}};
        if (!step.contains("name") || !step["name"].is_string())
        {
            throw std::invalid_argument("Java batch steps require a member name");
        }
        loader::native::parseName(step["name"].get<std::string>(),
                                  loader::native::kMaximumNativeNameBytes,
                                  "A Java batch member name");
        if (step.contains("args") &&
            (!step["args"].is_array() || step["args"].size() > kMaximumNativeArguments))
        {
            throw std::invalid_argument(
                "Java batch arguments must be an array of at most 16 values");
        }
        if (operation == "setField" && (!step.contains("value") || !step["value"].is_object()))
        {
            throw std::invalid_argument("A Java field write needs a value");
        }
    }
    return steps.dump();
}

static void callSetAssociatedObject(const JavaCallbacks &callbacks, const std::string &handle,
                                    const std::string &key, const std::string &value)
{
    JNIEnv *env = currentEnvironment();
    if (!env || !callbacks.bridgeClass || !callbacks.javaSetAssociatedObject)
    {
        throw std::runtime_error("The Android Java adapter is unavailable");
    }

    jstring inputHandle = toJavaString(env, handle);
    jstring inputKey    = toJavaString(env, key);
    jstring inputValue  = toJavaString(env, value);
    env->CallStaticVoidMethod(callbacks.bridgeClass, callbacks.javaSetAssociatedObject, inputHandle,
                              inputKey, inputValue,
                              static_cast<jint>(loader::native::kMaximumAssociationsPerObject));
    std::string failure =
        env->ExceptionCheck() ? takeJavaFailure(env, "The Android Java operation failed") : "";
    env->DeleteLocalRef(inputValue);
    env->DeleteLocalRef(inputKey);
    env->DeleteLocalRef(inputHandle);
    if (!failure.empty())
    {
        throw std::runtime_error(failure);
    }
}

static std::string serializeJavaArguments(jsi::Runtime &runtime, const jsi::Value *args,
                                          size_t count, size_t index)
{
    if (count <= index)
    {
        return "[]";
    }
    return loader::native::serializeBoundedArguments(runtime, args[index],
                                                     kNativeArgumentsConversion);
}

static std::string serializeJavaValue(jsi::Runtime &runtime, const jsi::Value &value)
{
    return loader::native::serializeBounded(runtime, value, kNativeArgumentsConversion);
}

static std::optional<std::string> javaHandleId(const nlohmann::json &value)
{
    auto type   = value.find("type");
    auto id     = value.find(type == value.end() ? "id" : "value");
    bool tagged = type != value.end() && type->is_string() && *type == "handle";
    bool bare   = type == value.end() && value.size() == 1;
    if ((tagged || bare) && id != value.end() && id->is_string() &&
        id->get<std::string>().rfind("java-", 0) == 0)
    {
        return id->get<std::string>();
    }
    return std::nullopt;
}

static std::mutex                                    gJavaLeasesMutex;
static std::shared_ptr<loader::native::HandleLeases> gJavaLeases;

static void leaseJavaHandles(const JavaCallbacks &callbacks)
{
    std::lock_guard<std::mutex> lock(gJavaLeasesMutex);
    if (gJavaLeases)
    {
        return;
    }
    gJavaLeases = std::make_shared<loader::native::HandleLeases>(
        javaHandleId, [callbacks](const std::string &id, uint64_t issues) {
            callJavaVoid(callbacks, callbacks.javaRelease,
                         {nlohmann::json{{"id", id}, {"issues", issues}}.dump()});
        });
}

static jsi::Value adoptJavaValue(jsi::Runtime &runtime, const nlohmann::json &value)
{
    std::shared_ptr<loader::native::HandleLeases> leases;
    {
        std::lock_guard<std::mutex> lock(gJavaLeasesMutex);
        leases = gJavaLeases;
    }
    return leases ? leases->adopt(runtime, value) : loader::toJSIValue(runtime, value);
}

static std::optional<jsi::Value> adoptTaggedJavaValue(jsi::Runtime      &runtime,
                                                      const std::string &response)
{
    std::optional<loader::native::TaggedValue> tagged = loader::native::parseTaggedValue(response);
    if (!tagged)
    {
        return std::nullopt;
    }
    if (tagged->kind == loader::native::TaggedValueKind::String && tagged->type == "handle" &&
        tagged->text.rfind("java-", 0) == 0)
    {
        std::shared_ptr<loader::native::HandleLeases> leases;
        {
            std::lock_guard<std::mutex> lock(gJavaLeasesMutex);
            leases = gJavaLeases;
        }
        if (leases)
        {
            return leases->adoptTaggedHandle(runtime, tagged->type, tagged->text);
        }
    }

    jsi::Object object(runtime);
    object.setProperty(runtime, "type", jsi::String::createFromUtf8(runtime, tagged->type));
    switch (tagged->kind)
    {
        case loader::native::TaggedValueKind::Null:
            object.setProperty(runtime, "value", jsi::Value::null());
            break;
        case loader::native::TaggedValueKind::Boolean:
            object.setProperty(runtime, "value", tagged->boolean);
            break;
        case loader::native::TaggedValueKind::Number:
            object.setProperty(runtime, "value", tagged->number);
            break;
        case loader::native::TaggedValueKind::String:
            object.setProperty(runtime, "value",
                               jsi::String::createFromUtf8(runtime, tagged->text));
            break;
    }
    return object;
}

static jsi::Value parseJavaResult(jsi::Runtime &runtime, const std::string &response)
{
    if (std::optional<jsi::Value> fast = adoptTaggedJavaValue(runtime, response))
    {
        return std::move(*fast);
    }

    nlohmann::json result = nlohmann::json::parse(response, nullptr, false);
    if (result.is_discarded())
    {
        throw std::runtime_error("The Android Java adapter returned invalid data");
    }

    return adoptJavaValue(runtime, result);
}

static jsi::Value javaAsynchronously(jsi::Runtime &runtime, std::function<std::string()> work)
{
    auto response = std::make_shared<std::string>();
    return loader::native::executeMainAsynchronously(
        runtime,
        [work = std::move(work), response]() {
            *response = work();
        },
        [response](jsi::Runtime &completion) -> jsi::Value {
            if (response->empty())
            {
                return jsi::Value::undefined();
            }
            return parseJavaResult(completion, *response);
        });
}

static jsi::Value javaSynchronously(jsi::Runtime &runtime, const JavaCallbacks &callbacks,
                                    jmethodID method, const std::vector<std::string> &arguments)
{
    return parseJavaResult(runtime, callJavaString(callbacks, method, arguments));
}

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
    std::shared_ptr<jsi::Function> callback;
    loader::AddonSlot              addon         = loader::kNoAddon;
    jsi::Runtime                  *inlineRuntime = nullptr;
};

static thread_local jsi::Runtime *gUIScopeRuntime = nullptr;

static bool onMainThread()
{
    return gettid() == getpid();
}

static std::mutex                                    gHookMutex;
static std::unordered_map<std::string, HookListener> gHookListeners;

void dispatchHookEvent(const std::string &token, const std::string &payload)
{
    HookListener listener;
    {
        std::lock_guard<std::mutex> lock(gHookMutex);
        auto                        found = gHookListeners.find(token);
        if (found == gHookListeners.end())
        {
            return;
        }
        listener = found->second;
    }

    loader::AddonScope                  scope(listener.addon);
    std::function<void(jsi::Runtime &)> deliver = [callback = listener.callback,
                                                   addon    = listener.addon,
                                                   payload](jsi::Runtime &runtime) {
        nlohmann::json parsed = nlohmann::json::parse(payload, nullptr, false);
        if (parsed.is_discarded())
        {
            return;
        }

        loader::AddonScope runtimeScope(addon);
        jsi::Value failure = catchingCall(runtime).call(runtime, jsi::Value(runtime, *callback),
                                                        adoptJavaValue(runtime, parsed));
        if (!failure.isString())
        {
            return;
        }
        std::optional<std::string> message =
            loader::threading::throttledHookFailure(addon, failure.asString(runtime).utf8(runtime));
        if (message)
        {
            loader::log(loader::LogLevel::Error, LOG_CATEGORY_PLUGINS, *message);
        }
    };

    if (!listener.inlineRuntime)
    {
        loader::native::executeRuntimeAsynchronously(std::move(deliver));
        return;
    }
    if (onMainThread())
    {
        deliver(*listener.inlineRuntime);
        return;
    }
    if (auto target = loader::native::executor())
    {
        target->runOnMain([token, deliver = std::move(deliver)]() {
            jsi::Runtime *runtime = nullptr;
            {
                std::lock_guard<std::mutex> lock(gHookMutex);
                auto                        found = gHookListeners.find(token);
                if (found != gHookListeners.end())
                {
                    runtime = found->second.inlineRuntime;
                }
            }
            if (runtime)
            {
                deliver(*runtime);
            }
        });
    }
}

static void rememberHookListener(jsi::Runtime &runtime, const std::string &token,
                                 const jsi::Value &listener)
{
    if (!listener.isObject() || !listener.asObject(runtime).isFunction(runtime))
    {
        return;
    }

    HookListener stored{
        std::make_shared<jsi::Function>(listener.asObject(runtime).asFunction(runtime)),
        loader::currentAddon(), gUIScopeRuntime};
    std::lock_guard<std::mutex> lock(gHookMutex);
    gHookListeners[token] = std::move(stored);
}

static void forgetHookListener(const std::string &token)
{
    std::lock_guard<std::mutex> lock(gHookMutex);
    gHookListeners.erase(token);
}

static void retireHookListeners()
{
    static auto                *retired = new std::vector<std::shared_ptr<jsi::Function>>();
    std::lock_guard<std::mutex> lock(gHookMutex);
    for (auto &entry : gHookListeners)
    {
        retired->push_back(std::move(entry.second.callback));
    }
    gHookListeners.clear();
}

static std::string hookTokenId(jsi::Runtime &runtime, const jsi::Value &value)
{
    return loader::native::parseHandleId(runtime, value, "A hook token");
}

static loader::native::NativeResourceRegistry &installedHooks()
{
    static loader::native::NativeResourceRegistry registry(loader::native::nativeHookBudget());
    return registry;
}

static loader::native::HookReturnCache &hookReturnValues()
{
    static loader::native::HookReturnCache cache(loader::native::nativeCachedReturnBudget());
    return cache;
}

std::optional<std::string> hookReturnValue(const std::string &token, const std::string &self,
                                           const std::string &arguments)
{
    return hookReturnValues().findSerialized(token, self, arguments);
}

static std::string installedHookToken(jsi::Runtime &runtime, const jsi::Value &value)
{
    std::string token = hookTokenId(runtime, value);
    if (!installedHooks().contains(token))
    {
        throw std::invalid_argument("The Android hook has been removed");
    }
    return token;
}

static nlohmann::json boundedJSON(jsi::Runtime &runtime, const jsi::Value &value)
{
    NativeConversionBudget budget(kNativeArgumentsConversion);
    nlohmann::json         result = loader::native::serializeBounded(runtime, value, budget);
    loader::native::dumpBounded(result, kNativeArgumentsConversion);
    return result;
}

static nlohmann::json boundedArgumentsJSON(jsi::Runtime &runtime, const jsi::Value &value)
{
    return nlohmann::json::parse(
        loader::native::serializeBoundedArguments(runtime, value, kNativeArgumentsConversion));
}

static void callBridgeVoid(const JavaCallbacks &callbacks, jmethodID method)
{
    JNIEnv *env = currentEnvironment();
    if (!env || !callbacks.bridgeClass || !method)
    {
        throw std::runtime_error("The Android bridge adapter is unavailable");
    }

    env->CallStaticVoidMethod(callbacks.bridgeClass, method);
    std::string failure =
        env->ExceptionCheck() ? takeJavaFailure(env, "The Android bridge operation failed") : "";
    if (!failure.empty())
    {
        throw std::runtime_error(failure);
    }
}

static void watchRuntimeGenerations(const JavaCallbacks &callbacks)
{
    static std::once_flag watching;
    std::call_once(watching, [callbacks]() {
        loader::native::onRuntimeGenerationChanged([callbacks](uint64_t) {
            retireHookListeners();
            hookReturnValues().clearAll();
            installedHooks().releaseAll();
            callBridgeVoid(callbacks, callbacks.runtimeReplaced);
        });
    });
}

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

static std::string surfaceContainer(jsi::Runtime &runtime, const jsi::Value &value)
{
    if (!value.isObject())
    {
        return "{}";
    }
    jsi::Object candidate = value.asObject(runtime);
    if (candidate.getProperty(runtime, "id").isString() ||
        candidate.getProperty(runtime, "value").isString())
    {
        return serializeJavaHandle(runtime, value);
    }
    return "{}";
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
               return javaAsynchronously(rt, [callbacks, arguments = std::move(arguments)]() {
                   return callJavaString(callbacks, callbacks.javaInvoke, arguments);
               });
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
               return javaAsynchronously(rt, [callbacks, arguments = std::move(arguments)]() {
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
               return javaAsynchronously(rt, [callbacks, arguments = std::move(arguments)]() {
                   return callJavaString(callbacks, callbacks.javaFindViews, arguments);
               });
           });
    define(runtime, java, "createAssociationKey", 0,
           [callbacks](jsi::Runtime &rt, const jsi::Value *, size_t) {
               return parseJavaResult(
                   rt, callJavaStringNoArguments(callbacks, callbacks.javaCreateAssociationKey));
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
    define(runtime, hooks, "hook", 5,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               requireArguments(count, 3,
                                "Hooks require a class name, a method name and parameter types");
               std::string parameters = serializeJavaArguments(rt, args, count, 2);
               std::string options    = count > 3 && args[3].isObject()
                                            ? serializeJavaValue(rt, args[3])
                                            : std::string("{}");
               loader::native::NativeResourceReservation reservation(
                   loader::native::nativeHookBudget(), "Too many native hooks are installed");
               std::string token = callJavaString(
                   callbacks, callbacks.hooksInstall,
                   {javaName(rt, args[0]), javaName(rt, args[1]), parameters, options});

               nlohmann::json parsed = nlohmann::json::parse(token, nullptr, false);
               if (parsed.is_discarded() || !parsed.contains("id") || !parsed["id"].is_string())
               {
                   throw std::runtime_error("The Android hook adapter returned no token");
               }
               installedHooks().adopt(parsed["id"].get<std::string>(), reservation);
               if (count > 4)
               {
                   rememberHookListener(rt, parsed["id"].get<std::string>(), args[4]);
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
    define(runtime, debug, "environment", 0, [](jsi::Runtime &rt, const jsi::Value *, size_t) {
        return loader::toJSIValue(rt, loader::currentDebugEnvironment());
    });
    return debug;
}

class AndroidFabricView final : public loader::native::FabricView
{
public:
    explicit AndroidFabricView(std::string handle) : handle(std::move(handle)) {}

    std::string handle;
};

class AndroidFabricAdapter final : public loader::native::FabricAdapter
{
public:
    explicit AndroidFabricAdapter(const JavaCallbacks &callbacks) : callbacks_(callbacks) {}

    std::shared_ptr<loader::native::FabricView> view(jsi::Runtime     &runtime,
                                                     const jsi::Value &handle) override
    {
        return std::make_shared<AndroidFabricView>(surfaceContainer(runtime, handle));
    }

    std::string mount(const loader::native::FabricView &container, const std::string &moduleName,
                      const nlohmann::json &properties) override
    {
        std::string handle =
            callJavaString(callbacks_, callbacks_.fabricMount,
                           {static_cast<const AndroidFabricView &>(container).handle, moduleName,
                            properties.dump()});
        nlohmann::json parsed = nlohmann::json::parse(handle, nullptr, false);
        if (parsed.is_discarded() || !parsed.contains("id") || !parsed["id"].is_string())
        {
            throw std::runtime_error("The Android surface adapter returned an invalid handle");
        }
        return parsed["id"].get<std::string>();
    }

    void update(const std::string &surface, const nlohmann::json &properties) override
    {
        callJavaVoid(callbacks_, callbacks_.fabricUpdate,
                     {loader::native::handleJSON(surface), properties.dump()});
    }

    void setSize(const std::string &surface, const loader::native::NativeSize &minimum,
                 const loader::native::NativeSize &maximum) override
    {
        callJavaVoid(callbacks_, callbacks_.fabricSetSize,
                     {loader::native::handleJSON(surface), loader::native::toJSON(minimum).dump(),
                      loader::native::toJSON(maximum).dump()});
    }

    void setFrame(const std::string &surface, const loader::native::NativeFrame &frame) override
    {
        callJavaVoid(callbacks_, callbacks_.fabricSetFrame,
                     {loader::native::handleJSON(surface), loader::native::toJSON(frame).dump()});
    }

    loader::native::NativeFrame measure(const loader::native::FabricView &view) override
    {
        return measureHandle(static_cast<const AndroidFabricView &>(view).handle);
    }

    loader::native::NativeFrame measureSurface(const std::string &surface) override
    {
        return measureHandle(loader::native::handleJSON(surface));
    }

    void unmount(const std::string &surface) override
    {
        callJavaBoolean(callbacks_, callbacks_.fabricUnmount, loader::native::handleJSON(surface));
    }

private:
    loader::native::NativeFrame measureHandle(const std::string &handle)
    {
        return loader::native::parseFrame(
            nlohmann::json::parse(callJavaString(callbacks_, callbacks_.fabricMeasure, {handle})));
    }

    JavaCallbacks callbacks_;
};

struct UIScopeState {
    JavaCallbacks            callbacks;
    loader::AddonSlot        addon = loader::kNoAddon;
    std::vector<std::string> allowed;
    std::mutex               mutex;
    std::vector<std::string> hooks;
    bool                     disposed = false;
};

static void disposeUIScope(UIScopeState &scope)
{
    std::vector<std::string> tokens;
    {
        std::lock_guard<std::mutex> lock(scope.mutex);
        if (scope.disposed)
        {
            return;
        }
        scope.disposed = true;
        tokens.swap(scope.hooks);
    }
    for (const std::string &token : tokens)
    {
        if (installedHooks().contains(token))
        {
            removeHook(scope.callbacks, token);
        }
    }
}

static bool scopeAllows(const UIScopeState &scope, const std::string &path)
{
    if (path.size() > 5 && path.compare(path.size() - 5, 5, "Async") == 0)
    {
        return false;
    }
    return std::find(scope.allowed.begin(), scope.allowed.end(), path) != scope.allowed.end();
}

static jsi::Object filterNamespace(jsi::Runtime &runtime, jsi::Object source,
                                   const UIScopeState &scope, const std::string &prefix)
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

static jsi::Value scopedHook(jsi::Runtime &runtime, const std::shared_ptr<UIScopeState> &scope,
                             const jsi::Function &install, const jsi::Value *args, size_t count)
{
    {
        std::lock_guard<std::mutex> lock(scope->mutex);
        if (scope->disposed)
        {
            throw jsi::JSError(runtime, "The UI scope has been disposed");
        }
    }
    loader::AddonScope addonScope(scope->addon);
    jsi::Runtime      *previousRuntime = gUIScopeRuntime;
    gUIScopeRuntime                    = &runtime;
    jsi::Value token;
    try
    {
        token = install.call(runtime, args, count);
    }
    catch (...)
    {
        gUIScopeRuntime = previousRuntime;
        throw;
    }
    gUIScopeRuntime                = previousRuntime;
    std::string                 id = hookTokenId(runtime, token);
    std::lock_guard<std::mutex> lock(scope->mutex);
    scope->hooks.push_back(id);
    return token;
}

static jsi::Object makeScopedHooks(jsi::Runtime                        &runtime,
                                   const std::shared_ptr<UIScopeState> &scope)
{
    jsi::Object hooks =
        filterNamespace(runtime, makeHooksNamespace(runtime, scope->callbacks), *scope, "hooks.");
    if (!hooks.hasProperty(runtime, "hook"))
    {
        return hooks;
    }
    auto install = std::make_shared<jsi::Function>(hooks.getPropertyAsFunction(runtime, "hook"));
    define(runtime, hooks, "hook", 5,
           [scope, install](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               return scopedHook(rt, scope, *install, args, count);
           });
    return hooks;
}

class UIScopeHost final : public jsi::HostObject
{
public:
    explicit UIScopeHost(std::shared_ptr<UIScopeState> scope) : scope_(std::move(scope)) {}

    ~UIScopeHost() override
    {
        disposeUIScope(*scope_);
    }

    // Hermes on Android cannot take a C++ exception, so a failed read returns a failure envelope.
    jsi::Value get(jsi::Runtime &runtime, const jsi::PropNameID &property) override
    {
        return loader::native::guard(runtime, [&]() -> jsi::Value {
            std::string name = property.utf8(runtime);
            if (name == "dispose")
            {
                auto scope = scope_;
                return loader::native::makeFunction(
                    runtime, "dispose", 0,
                    [scope](jsi::Runtime &, const jsi::Value &, const jsi::Value *, size_t) {
                        disposeUIScope(*scope);
                        return jsi::Value::undefined();
                    });
            }
            if (name == "java")
            {
                loader::AddonScope addonScope(scope_->addon);
                return filterNamespace(runtime, makeJavaNamespace(runtime, scope_->callbacks),
                                       *scope_, "java.");
            }
            if (name == "hooks")
            {
                return makeScopedHooks(runtime, scope_);
            }
            return jsi::Value::undefined();
        });
    }

private:
    std::shared_ptr<UIScopeState> scope_;
};

static jsi::Value createUIScope(jsi::Runtime &runtime, const JavaCallbacks &callbacks,
                                const jsi::Value *args, size_t count)
{
    if (count < 1 || !args[0].isObject() || !args[0].asObject(runtime).isArray(runtime))
    {
        throw jsi::JSError(runtime,
                           "java.createUIScope expects the method paths the scope may use");
    }
    auto scope       = std::make_shared<UIScopeState>();
    scope->callbacks = callbacks;
    scope->addon     = loader::currentAddon();
    jsi::Array paths = args[0].asObject(runtime).asArray(runtime);
    for (size_t index = 0; index < paths.size(runtime); index++)
    {
        jsi::Value path = paths.getValueAtIndex(runtime, index);
        if (path.isString())
        {
            scope->allowed.push_back(path.getString(runtime).utf8(runtime));
        }
    }
    return jsi::Object::createFromHostObject(runtime, std::make_shared<UIScopeHost>(scope));
}

void registerNativePluginBridge(jsi::Runtime &runtime, const JavaCallbacks &callbacks)
{
    watchRuntimeGenerations(callbacks);
    leaseJavaHandles(callbacks);

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
    bridge.addNamespace("fabric", loader::native::makeFabricNamespace(
                                      runtime, std::make_shared<AndroidFabricAdapter>(callbacks),
                                      loader::native::FabricCalls::AsyncOnly));
    bridge.install();
}
}
