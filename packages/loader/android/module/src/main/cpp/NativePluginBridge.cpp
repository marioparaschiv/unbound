#include "NativePluginBridge.h"

#include <algorithm>
#include <cmath>
#include <functional>
#include <iterator>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <vector>

#include "JniEnvironment.h"
#include "LoaderAddonActivity.h"
#include "NativeBoundedValue.h"
#include "NativeEvaluations.h"
#include "NativeFFI.h"
#include "NativeFabric.h"
#include "NativeGeometry.h"
#include "NativeHookReturnCache.h"
#include "NativeLimits.h"
#include "NativePlatformBridge.h"
#include "NativePluginRoot.h"
#include "NativeResourceBudget.h"
#include "NativeTraversalOptions.h"

namespace unbound::android {
namespace jsi = facebook::jsi;

static constexpr size_t kMaximumQueryBytes       = 8192;
static constexpr size_t kMaximumQueryAttributes  = 32;
static constexpr size_t kMaximumQueryStringBytes = 256;

static nlohmann::json scalarAttributes(jsi::Runtime &runtime, const jsi::Object &query)
{
    jsi::Value value = query.getProperty(runtime, "attributes");
    if (!value.isObject() || value.isNull())
    {
        return nlohmann::json::object();
    }

    jsi::Object object = value.asObject(runtime);
    if (object.isArray(runtime))
    {
        throw std::invalid_argument("attributes must be a plain object");
    }

    jsi::Array names = object.getPropertyNames(runtime);
    if (names.size(runtime) > kMaximumQueryAttributes)
    {
        throw std::invalid_argument("attributes exceeds the maximum number of entries");
    }

    nlohmann::json result = nlohmann::json::object();
    for (size_t index = 0; index < names.size(runtime); index++)
    {
        jsi::Value nameValue = names.getValueAtIndex(runtime, index);
        if (!nameValue.isString())
        {
            throw std::invalid_argument("attribute names must be strings");
        }

        std::string name = nameValue.getString(runtime).utf8(runtime);
        if (name.empty() || name.size() > 64)
        {
            throw std::invalid_argument("attribute names must be 1 to 64 bytes");
        }

        jsi::Value attribute = object.getProperty(runtime, name.c_str());
        if (attribute.isString())
        {
            std::string text = attribute.getString(runtime).utf8(runtime);
            if (text.size() > kMaximumQueryStringBytes)
            {
                throw std::invalid_argument("attribute strings exceed 256 bytes");
            }
            result[name] = std::move(text);
        }
        else if (attribute.isBool())
        {
            result[name] = attribute.getBool();
        }
        else if (attribute.isNumber() && std::isfinite(attribute.getNumber()))
        {
            result[name] = attribute.getNumber();
        }
        else if (attribute.isNull())
        {
            result[name] = nullptr;
        }
        else
        {
            throw std::invalid_argument("attribute values must be scalar");
        }
    }

    return result;
}

static std::string serializeQuery(jsi::Runtime &runtime, const jsi::Value &value)
{
    if (!value.isObject() || value.isNull())
    {
        throw std::invalid_argument("a native UI query object is required");
    }

    jsi::Object input = value.asObject(runtime);
    if (input.isArray(runtime))
    {
        throw std::invalid_argument("a native UI query must be a plain object");
    }

    jsi::Value roleValue = input.getProperty(runtime, "role");
    if (!roleValue.isString())
    {
        throw std::invalid_argument("a native UI query requires a role string");
    }

    std::string role = loader::native::parseName(
        runtime, roleValue, loader::native::kMaximumQueryRoleBytes, "The native UI query role");

    loader::native::TraversalOptions limits = loader::native::parseTraversalOptions(
        runtime, value, loader::native::TraversalProfile::Query);
    nlohmann::json query = nlohmann::json::object();
    query["role"]        = std::move(role);
    query["attributes"]  = scalarAttributes(runtime, input);
    query["maxDepth"]    = limits.maxDepth;
    query["maxNodes"]    = limits.maxNodes;
    query["maxResults"]  = limits.maxResults;

    jsi::Value rootValue = input.getProperty(runtime, "root");
    if (rootValue.isObject())
    {
        query["root"] = {
            {"id", loader::native::parseHandleId(runtime, rootValue, "A native UI root handle")}};
    }

    std::string serialized = query.dump();
    if (serialized.size() > kMaximumQueryBytes)
    {
        throw std::invalid_argument("the native UI query exceeds 8192 bytes");
    }

    return serialized;
}

static std::string serializeHandle(jsi::Runtime &runtime, const jsi::Value &value)
{
    return loader::native::handleJSON(
        loader::native::parseHandleId(runtime, value, "A native UI handle"));
}

static std::string serializeFrame(jsi::Runtime &runtime, const jsi::Value &value)
{
    return loader::native::toJSON(loader::native::parseFrame(runtime, value)).dump();
}

static std::string serializeSize(jsi::Runtime &runtime, const jsi::Value &value)
{
    return loader::native::toJSON(loader::native::parseSize(runtime, value)).dump();
}

static std::string serializeNativeProperties(jsi::Runtime &runtime, const jsi::Value &value)
{
    return loader::native::serializeBoundedObject(runtime, value, kNativePropertiesConversion);
}

static std::string callQuery(const JavaCallbacks &callbacks, jmethodID method,
                             const std::string &query)
{
    JNIEnv *env = currentEnvironment();
    if (!env || !callbacks.bridgeClass || !method)
    {
        throw std::runtime_error("The Android native UI adapter is unavailable");
    }

    jstring input = toJavaString(env, query);
    auto    output =
        static_cast<jstring>(env->CallStaticObjectMethod(callbacks.bridgeClass, method, input));
    bool failed = clearPendingException(env);
    env->DeleteLocalRef(input);
    if (failed || !output)
    {
        if (output)
        {
            env->DeleteLocalRef(output);
        }
        throw std::runtime_error("The Android native UI query failed");
    }

    std::string result = toStdString(env, output);
    env->DeleteLocalRef(output);
    return result;
}

static std::string callMeasure(const JavaCallbacks &callbacks, jmethodID method,
                               const std::string &handle)
{
    JNIEnv *env = currentEnvironment();
    if (!env || !callbacks.bridgeClass || !method)
    {
        throw std::runtime_error("The Android native UI adapter is unavailable");
    }

    jstring input = toJavaString(env, handle);
    auto    output =
        static_cast<jstring>(env->CallStaticObjectMethod(callbacks.bridgeClass, method, input));
    bool failed = clearPendingException(env);
    env->DeleteLocalRef(input);
    if (failed || !output)
    {
        if (output)
        {
            env->DeleteLocalRef(output);
        }
        throw std::runtime_error("The Android native UI measurement failed");
    }

    std::string result = toStdString(env, output);
    env->DeleteLocalRef(output);
    return result;
}

static void callSetFrame(const JavaCallbacks &callbacks, jmethodID method,
                         const std::string &handle, const std::string &frame)
{
    JNIEnv *env = currentEnvironment();
    if (!env || !callbacks.bridgeClass || !method)
    {
        throw std::runtime_error("The Android native UI adapter is unavailable");
    }

    jstring inputHandle = toJavaString(env, handle);
    jstring inputFrame  = toJavaString(env, frame);
    env->CallStaticVoidMethod(callbacks.bridgeClass, method, inputHandle, inputFrame);
    bool failed = clearPendingException(env);
    env->DeleteLocalRef(inputFrame);
    env->DeleteLocalRef(inputHandle);
    if (failed)
    {
        throw std::runtime_error("The Android native UI frame update failed");
    }
}

static std::string callMount(const JavaCallbacks &callbacks, const std::string &container,
                             const std::string &moduleName, const std::string &properties)
{
    JNIEnv *env = currentEnvironment();
    if (!env || !callbacks.bridgeClass || !callbacks.mountView)
    {
        throw std::runtime_error("The Android native UI adapter is unavailable");
    }

    jstring inputContainer  = toJavaString(env, container);
    jstring inputModule     = toJavaString(env, moduleName);
    jstring inputProperties = toJavaString(env, properties);
    auto    output          = static_cast<jstring>(env->CallStaticObjectMethod(
        callbacks.bridgeClass, callbacks.mountView, inputContainer, inputModule, inputProperties));
    bool    failed          = clearPendingException(env);
    env->DeleteLocalRef(inputProperties);
    env->DeleteLocalRef(inputModule);
    env->DeleteLocalRef(inputContainer);
    if (failed || !output)
    {
        if (output)
        {
            env->DeleteLocalRef(output);
        }
        throw std::runtime_error("The Android native UI mount failed");
    }

    std::string result = toStdString(env, output);
    env->DeleteLocalRef(output);
    return result;
}

static void callUpdate(const JavaCallbacks &callbacks, const std::string &handle,
                       const std::string &properties)
{
    JNIEnv *env = currentEnvironment();
    if (!env || !callbacks.bridgeClass || !callbacks.updateView)
    {
        throw std::runtime_error("The Android native UI adapter is unavailable");
    }

    jstring inputHandle     = toJavaString(env, handle);
    jstring inputProperties = toJavaString(env, properties);
    env->CallStaticVoidMethod(callbacks.bridgeClass, callbacks.updateView, inputHandle,
                              inputProperties);
    bool failed = clearPendingException(env);
    env->DeleteLocalRef(inputProperties);
    env->DeleteLocalRef(inputHandle);
    if (failed)
    {
        throw std::runtime_error("The Android native UI update failed");
    }
}

static void callUnmount(const JavaCallbacks &callbacks, const std::string &handle)
{
    JNIEnv *env = currentEnvironment();
    if (!env || !callbacks.bridgeClass || !callbacks.unmountView)
    {
        throw std::runtime_error("The Android native UI adapter is unavailable");
    }

    jstring inputHandle = toJavaString(env, handle);
    env->CallStaticVoidMethod(callbacks.bridgeClass, callbacks.unmountView, inputHandle);
    bool failed = clearPendingException(env);
    env->DeleteLocalRef(inputHandle);
    if (failed)
    {
        throw std::runtime_error("The Android native UI unmount failed");
    }
}

static jsi::Value queryUI(jsi::Runtime &runtime, const jsi::Value *args, size_t count,
                          const JavaCallbacks &callbacks, jmethodID method)
{
    if (count != 1)
    {
        loader::native::throwCoded(runtime, "NATIVE_BRIDGE_ERROR",
                                   "Native UI queries require exactly one argument");
    }

    std::string query    = serializeQuery(runtime, args[0]);
    auto        response = std::make_shared<std::string>();
    return loader::native::executeMainAsynchronously(
        runtime,
        [callbacks, method, query = std::move(query), response]() {
            *response = callQuery(callbacks, method, query);
        },
        [response](jsi::Runtime &completion) -> jsi::Value {
            nlohmann::json result = nlohmann::json::parse(*response, nullptr, false);
            if (result.is_discarded())
            {
                throw std::runtime_error("The Android native UI adapter returned invalid data");
            }
            return loader::toJSIValue(completion, result);
        });
}

static jsi::Value measureUI(jsi::Runtime &runtime, const jsi::Value *args, size_t count,
                            const JavaCallbacks &callbacks)
{
    if (count != 1)
    {
        loader::native::throwCoded(runtime, "NATIVE_BRIDGE_ERROR",
                                   "Native UI measurement requires exactly one argument");
    }

    std::string handle   = serializeHandle(runtime, args[0]);
    auto        response = std::make_shared<std::string>();
    return loader::native::executeMainAsynchronously(
        runtime,
        [callbacks, handle = std::move(handle), response]() {
            *response = callMeasure(callbacks, callbacks.measureView, handle);
        },
        [response](jsi::Runtime &completion) -> jsi::Value {
            nlohmann::json result = nlohmann::json::parse(*response, nullptr, false);
            if (result.is_discarded() || !result.is_object())
            {
                throw std::runtime_error("The Android native UI adapter returned invalid data");
            }
            return loader::toJSIValue(completion, result);
        });
}

static jsi::Value setFrameUI(jsi::Runtime &runtime, const jsi::Value *args, size_t count,
                             const JavaCallbacks &callbacks)
{
    if (count != 2)
    {
        loader::native::throwCoded(runtime, "NATIVE_BRIDGE_ERROR",
                                   "Native UI frame updates require exactly two arguments");
    }

    std::string handle = serializeHandle(runtime, args[0]);
    std::string frame  = serializeFrame(runtime, args[1]);
    return loader::native::executeMainAsynchronously(
        runtime,
        [callbacks, handle = std::move(handle), frame = std::move(frame)]() {
            callSetFrame(callbacks, callbacks.setViewFrame, handle, frame);
        },
        [](jsi::Runtime &) -> jsi::Value {
            return jsi::Value::undefined();
        });
}

static jsi::Value mountUI(jsi::Runtime &runtime, const jsi::Value *args, size_t count,
                          const JavaCallbacks &callbacks)
{
    if (count < 2 || count > 3 || !args[1].isString())
    {
        loader::native::throwCoded(
            runtime, "NATIVE_BRIDGE_ERROR",
            "Native UI mounting requires a container, module name and optional properties");
    }

    std::string container  = args[0].isNull() || args[0].isUndefined()
                                 ? std::string()
                                 : serializeHandle(runtime, args[0]);
    std::string moduleName = loader::native::parseName(
        runtime, args[1], loader::native::kMaximumNativeNameBytes, "A native UI module name");
    std::string properties = "{}";
    if (count == 3)
    {
        properties = serializeNativeProperties(runtime, args[2]);
    }
    auto response = std::make_shared<std::string>();
    return loader::native::executeMainAsynchronously(
        runtime,
        [callbacks, container = std::move(container), moduleName = std::move(moduleName),
         properties = std::move(properties), response]() {
            *response = callMount(callbacks, container, moduleName, properties);
        },
        [response](jsi::Runtime &completion) -> jsi::Value {
            nlohmann::json handle = nlohmann::json::parse(*response, nullptr, false);
            if (handle.is_discarded() || !handle.is_object() || !handle.contains("id") ||
                !handle["id"].is_string())
            {
                throw std::runtime_error(
                    "The Android native UI adapter returned an invalid handle");
            }
            return loader::toJSIValue(completion, handle);
        });
}

static jsi::Value updateUI(jsi::Runtime &runtime, const jsi::Value *args, size_t count,
                           const JavaCallbacks &callbacks)
{
    if (count != 2)
    {
        loader::native::throwCoded(runtime, "NATIVE_BRIDGE_ERROR",
                                   "Native UI updates require a handle and properties");
    }

    std::string handle     = serializeHandle(runtime, args[0]);
    std::string properties = serializeNativeProperties(runtime, args[1]);
    return loader::native::executeMainAsynchronously(
        runtime,
        [callbacks, handle = std::move(handle), properties = std::move(properties)]() {
            callUpdate(callbacks, handle, properties);
        },
        [](jsi::Runtime &) -> jsi::Value {
            return jsi::Value::undefined();
        });
}

static jsi::Value unmountUI(jsi::Runtime &runtime, const jsi::Value *args, size_t count,
                            const JavaCallbacks &callbacks)
{
    if (count != 1)
    {
        loader::native::throwCoded(runtime, "NATIVE_BRIDGE_ERROR",
                                   "Native UI unmounting requires exactly one handle");
    }

    std::string handle = serializeHandle(runtime, args[0]);
    return loader::native::executeMainAsynchronously(
        runtime,
        [callbacks, handle = std::move(handle)]() {
            callUnmount(callbacks, handle);
        },
        [](jsi::Runtime &) -> jsi::Value {
            return jsi::Value::undefined();
        });
}

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

static jsi::Value parseJavaResult(jsi::Runtime &runtime, const std::string &response)
{
    nlohmann::json result = nlohmann::json::parse(response, nullptr, false);
    if (result.is_discarded())
    {
        throw std::runtime_error("The Android Java adapter returned invalid data");
    }

    return loader::toJSIValue(runtime, result);
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

struct HookListener {
    std::shared_ptr<jsi::Function> callback;
    loader::AddonSlot              addon = loader::kNoAddon;
};

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

    loader::AddonScope scope(listener.addon);
    loader::native::executeRuntimeAsynchronously(
        [listener = listener.callback, payload](jsi::Runtime &runtime) {
            nlohmann::json parsed = nlohmann::json::parse(payload, nullptr, false);
            if (parsed.is_discarded())
            {
                return;
            }

            listener->call(runtime, loader::toJSIValue(runtime, parsed));
        });
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
        loader::currentAddon()};
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

static jsi::Object makeUINamespace(jsi::Runtime &runtime, const JavaCallbacks &callbacks)
{
    jsi::Object ui(runtime);
    define(runtime, ui, "lookup", 1,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               return queryUI(rt, args, count, callbacks, callbacks.lookupViews);
           });
    define(runtime, ui, "snapshot", 1,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               return queryUI(rt, args, count, callbacks, callbacks.snapshotViews);
           });
    define(runtime, ui, "measure", 1,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               return measureUI(rt, args, count, callbacks);
           });
    define(runtime, ui, "setFrame", 2,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               return setFrameUI(rt, args, count, callbacks);
           });
    define(runtime, ui, "mount", 3,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               return mountUI(rt, args, count, callbacks);
           });
    define(runtime, ui, "update", 2,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               return updateUI(rt, args, count, callbacks);
           });
    define(runtime, ui, "unmount", 1,
           [callbacks](jsi::Runtime &rt, const jsi::Value *args, size_t count) {
               return unmountUI(rt, args, count, callbacks);
           });
    return ui;
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
               std::string token = hookTokenId(rt, args[0]);
               forgetHookListener(token);
               hookReturnValues().clear(token);
               installedHooks().release(token);
               callJavaVoid(callbacks, callbacks.hooksRemove, {loader::native::handleJSON(token)});
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

void registerNativePluginBridge(jsi::Runtime &runtime, const JavaCallbacks &callbacks)
{
    watchRuntimeGenerations(callbacks);

    loader::native::NativePluginRootBuilder bridge(runtime,
                                                   loader::native::NativePluginPlatform::Android);
    bridge.addNamespace("ui", makeUINamespace(runtime, callbacks));
    bridge.addNamespace("java", makeJavaNamespace(runtime, callbacks));
    bridge.addNamespace("ffi", makeFFINamespace(runtime));
    bridge.addNamespace("hooks", makeHooksNamespace(runtime, callbacks));
    bridge.addNamespace("debug", makeDebugNamespace(runtime, callbacks));
    bridge.addNamespace("fabric", loader::native::makeFabricNamespace(
                                      runtime, std::make_shared<AndroidFabricAdapter>(callbacks),
                                      loader::native::FabricCalls::AsyncOnly));
    bridge.install();
}
}
