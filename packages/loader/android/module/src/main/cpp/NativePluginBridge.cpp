#include "NativePluginBridge.h"

#include "JniEnvironment.h"
#include "NativeFFI.h"
#include "NativePlatformBridge.h"
#include "NativePluginVersion.h"

#include <algorithm>
#include <cmath>
#include <functional>
#include <iterator>
#include <memory>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <mutex>
#include <vector>

namespace unbound::android
{
    namespace jsi = facebook::jsi;

    static constexpr size_t kMaximumQueryBytes = 8192;
    static constexpr size_t kMaximumQueryAttributes = 32;
    static constexpr size_t kMaximumQueryStringBytes = 256;
    static constexpr size_t kMaximumNativePropertyBytes = 16384;
    static constexpr size_t kMaximumNativePropertyEntries = 512;
    static constexpr size_t kMaximumNativePropertyDepth = 8;

    static int boundedInteger(jsi::Runtime &runtime, const jsi::Object &query, const char *name,
                              int fallback, int maximum)
    {
        jsi::Value value = query.getProperty(runtime, name);
        if (!value.isNumber())
        {
            return fallback;
        }

        double number = value.getNumber();
        if (!std::isfinite(number) || std::floor(number) != number)
        {
            throw std::invalid_argument(std::string(name) + " must be a finite integer");
        }

        if (number < 1)
        {
            return 1;
        }
        if (number > maximum)
        {
            return maximum;
        }
        return static_cast<int>(number);
    }

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

        std::string role = roleValue.getString(runtime).utf8(runtime);
        if (role.empty() || role.size() > 128)
        {
            throw std::invalid_argument("the native UI query role must be 1 to 128 bytes");
        }

        nlohmann::json query = nlohmann::json::object();
        query["role"]      = std::move(role);
        query["attributes"] = scalarAttributes(runtime, input);
        query["maxDepth"]   = boundedInteger(runtime, input, "maxDepth", 16, 64);
        query["maxNodes"]   = boundedInteger(runtime, input, "maxNodes", 512, 2000);
        query["maxResults"] = boundedInteger(runtime, input, "maxResults", 128, 500);

        jsi::Value rootValue = input.getProperty(runtime, "root");
        if (rootValue.isObject() && !rootValue.isNull())
        {
            jsi::Object root = rootValue.asObject(runtime);
            jsi::Value  id   = root.getProperty(runtime, "id");
            if (!id.isString())
            {
                throw std::invalid_argument("a native UI root handle must contain a string id");
            }
            query["root"] = { { "id", id.getString(runtime).utf8(runtime) } };
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
        if (!value.isObject() || value.isNull())
        {
            throw std::invalid_argument("a native UI handle is required");
        }

        jsi::Object handle = value.asObject(runtime);
        if (handle.isArray(runtime))
        {
            throw std::invalid_argument("a native UI handle must be a plain object");
        }

        jsi::Value id = handle.getProperty(runtime, "id");
        if (!id.isString())
        {
            throw std::invalid_argument("a native UI handle must contain a string id");
        }

        std::string identifier = id.getString(runtime).utf8(runtime);
        if (identifier.empty() || identifier.size() > 128)
        {
            throw std::invalid_argument("a native UI handle id must be 1 to 128 bytes");
        }

        return nlohmann::json({ { "id", identifier } }).dump();
    }

    static std::string serializeFrame(jsi::Runtime &runtime, const jsi::Value &value)
    {
        if (!value.isObject() || value.isNull())
        {
            throw std::invalid_argument("a native UI frame object is required");
        }

        jsi::Object input = value.asObject(runtime);
        if (input.isArray(runtime))
        {
            throw std::invalid_argument("a native UI frame must be a plain object");
        }

        nlohmann::json frame = nlohmann::json::object();
        for (const char *field : { "x", "y", "width", "height" })
        {
            jsi::Value coordinate = input.getProperty(runtime, field);
            if (!coordinate.isNumber() || !std::isfinite(coordinate.getNumber()))
            {
                throw std::invalid_argument(std::string("native UI frame ") + field +
                                            " must be a finite number");
            }

            double      number = coordinate.getNumber();
            std::string name(field);
            if ((name == "width" || name == "height") && (number <= 0 || number > 32768))
            {
                throw std::invalid_argument(std::string("native UI frame ") + field +
                                            " must be greater than zero and at most 32768");
            }
            if ((name == "x" || name == "y") && (number < -100000 || number > 100000))
            {
                throw std::invalid_argument(std::string("native UI frame ") + field +
                                            " must be between -100000 and 100000");
            }

            frame[field] = number;
        }

        return frame.dump();
    }

    static nlohmann::json serializeNativeValue(jsi::Runtime &runtime, const jsi::Value &value,
                                               size_t depth, size_t &entries)
    {
        if (depth > kMaximumNativePropertyDepth || ++entries > kMaximumNativePropertyEntries)
        {
            throw std::invalid_argument("native UI properties exceed their structural limits");
        }

        if (value.isNull())
        {
            return nullptr;
        }
        if (value.isBool())
        {
            return value.getBool();
        }
        if (value.isNumber())
        {
            double number = value.getNumber();
            if (!std::isfinite(number))
            {
                throw std::invalid_argument("native UI property numbers must be finite");
            }
            return number;
        }
        if (value.isString())
        {
            std::string text = value.getString(runtime).utf8(runtime);
            if (text.size() > 4096)
            {
                throw std::invalid_argument("native UI property strings exceed 4096 bytes");
            }
            return text;
        }
        if (!value.isObject() || value.isUndefined())
        {
            throw std::invalid_argument("native UI properties must contain serializable values");
        }

        jsi::Object object = value.asObject(runtime);
        if (object.isHostObject(runtime))
        {
            throw std::invalid_argument("native object handles cannot be used as native UI properties");
        }

        if (object.isArray(runtime))
        {
            jsi::Array array = object.asArray(runtime);
            if (array.size(runtime) > kMaximumNativePropertyEntries)
            {
                throw std::invalid_argument("native UI property arrays exceed 512 entries");
            }

            nlohmann::json result = nlohmann::json::array();
            for (size_t index = 0; index < array.size(runtime); index++)
            {
                result.push_back(serializeNativeValue(runtime, array.getValueAtIndex(runtime, index),
                                                      depth + 1, entries));
            }
            return result;
        }

        jsi::Array names = object.getPropertyNames(runtime);
        if (names.size(runtime) > kMaximumNativePropertyEntries)
        {
            throw std::invalid_argument("native UI property objects exceed 512 entries");
        }

        nlohmann::json result = nlohmann::json::object();
        for (size_t index = 0; index < names.size(runtime); index++)
        {
            jsi::Value nameValue = names.getValueAtIndex(runtime, index);
            if (!nameValue.isString())
            {
                throw std::invalid_argument("native UI property names must be strings");
            }

            std::string name = nameValue.getString(runtime).utf8(runtime);
            if (name.empty() || name.size() > 64)
            {
                throw std::invalid_argument("native UI property names must be 1 to 64 bytes");
            }

            result[name] = serializeNativeValue(runtime, object.getProperty(runtime, name.c_str()),
                                                depth + 1, entries);
        }

        return result;
    }

    static std::string serializeNativeProperties(jsi::Runtime &runtime,
                                                 const jsi::Value &value)
    {
        if (!value.isObject() || value.isNull())
        {
            throw std::invalid_argument("native UI properties must be a plain object");
        }

        jsi::Object object = value.asObject(runtime);
        if (object.isArray(runtime) || object.isHostObject(runtime))
        {
            throw std::invalid_argument("native UI properties must be a plain object");
        }

        size_t entries = 0;
        nlohmann::json properties = serializeNativeValue(runtime, value, 0, entries);
        std::string serialized = properties.dump();
        if (serialized.size() > kMaximumNativePropertyBytes)
        {
            throw std::invalid_argument("native UI properties exceed 16384 bytes");
        }

        return serialized;
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
        auto    output = static_cast<jstring>(
            env->CallStaticObjectMethod(callbacks.bridgeClass, method, input));
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
        auto    output = static_cast<jstring>(
            env->CallStaticObjectMethod(callbacks.bridgeClass, method, input));
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

        jstring inputContainer = toJavaString(env, container);
        jstring inputModule = toJavaString(env, moduleName);
        jstring inputProperties = toJavaString(env, properties);
        auto output = static_cast<jstring>(env->CallStaticObjectMethod(
            callbacks.bridgeClass, callbacks.mountView, inputContainer, inputModule, inputProperties));
        bool failed = clearPendingException(env);
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

        jstring inputHandle = toJavaString(env, handle);
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

        std::string query = serializeQuery(runtime, args[0]);
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

        std::string handle = serializeHandle(runtime, args[0]);
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
            [](jsi::Runtime &) -> jsi::Value { return jsi::Value::undefined(); });
    }

    static jsi::Value mountUI(jsi::Runtime &runtime, const jsi::Value *args, size_t count,
                              const JavaCallbacks &callbacks)
    {
        if (count < 2 || count > 3 || !args[1].isString())
        {
            loader::native::throwCoded(runtime, "NATIVE_BRIDGE_ERROR",
                                       "Native UI mounting requires a container, module name and optional properties");
        }

        std::string container = args[0].isNull() || args[0].isUndefined()
                                    ? std::string()
                                    : serializeHandle(runtime, args[0]);
        std::string moduleName = args[1].getString(runtime).utf8(runtime);
        if (moduleName.empty() || moduleName.size() > 128)
        {
            loader::native::throwCoded(runtime, "NATIVE_BRIDGE_ERROR",
                                       "Native UI module names must be 1 to 128 bytes");
        }
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
                if (handle.is_discarded() || !handle.is_object() ||
                    !handle.contains("id") || !handle["id"].is_string())
                {
                    throw std::runtime_error("The Android native UI adapter returned an invalid handle");
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

        std::string handle = serializeHandle(runtime, args[0]);
        std::string properties = serializeNativeProperties(runtime, args[1]);
        return loader::native::executeMainAsynchronously(
            runtime,
            [callbacks, handle = std::move(handle), properties = std::move(properties)]() {
                callUpdate(callbacks, handle, properties);
            },
            [](jsi::Runtime &) -> jsi::Value { return jsi::Value::undefined(); });
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
            [callbacks, handle = std::move(handle)]() { callUnmount(callbacks, handle); },
            [](jsi::Runtime &) -> jsi::Value { return jsi::Value::undefined(); });
    }

    static constexpr size_t kMaximumJavaNameBytes      = 256;
    static constexpr size_t kMaximumJavaArgumentBytes  = 16384;
    static constexpr size_t kMaximumJavaArgumentCount  = 16;

    static jsi::Value javaFailure(jsi::Runtime &runtime, const char *code, const std::string &message)
    {
        jsi::Object failure(runtime);
        failure.setProperty(runtime, "code", jsi::String::createFromUtf8(runtime, code));
        failure.setProperty(runtime, "message", jsi::String::createFromUtf8(runtime, message));

        jsi::Object wrapper(runtime);
        wrapper.setProperty(runtime, "__nativeFailure", std::move(failure));
        return wrapper;
    }

    static jsi::Value guardJava(jsi::Runtime &runtime, const std::function<jsi::Value()> &body)
    {
        try
        {
            return body();
        }
        catch (const loader::native::NativeCodedError &error)
        {
            return javaFailure(runtime, error.code().c_str(), error.what());
        }
        catch (const jsi::JSError &error)
        {
            return javaFailure(runtime, "NATIVE_BRIDGE_ERROR", error.getMessage());
        }
        catch (const std::exception &error)
        {
            return javaFailure(runtime, "NATIVE_BRIDGE_ERROR", error.what());
        }
        catch (...)
        {
            return javaFailure(runtime, "NATIVE_BRIDGE_ERROR", "The Java operation failed");
        }
    }

    static std::string takeJavaFailure(JNIEnv *env, const char *fallback)
    {
        jthrowable thrown = env->ExceptionOccurred();
        if (!thrown)
        {
            return fallback;
        }

        env->ExceptionClear();
        jclass throwableClass = env->GetObjectClass(thrown);
        jmethodID describe =
            env->GetMethodID(throwableClass, "toString", "()Ljava/lang/String;");
        std::string message = fallback;
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
            output =
                env->CallStaticObjectMethod(callbacks.bridgeClass, method, inputs[0], inputs[1]);
        }
        else if (inputs.size() == 3)
        {
            output = env->CallStaticObjectMethod(callbacks.bridgeClass, method, inputs[0],
                                                 inputs[1], inputs[2]);
        }
        else if (inputs.size() == 4)
        {
            output = env->CallStaticObjectMethod(callbacks.bridgeClass, method, inputs[0],
                                                 inputs[1], inputs[2], inputs[3]);
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
            env->CallStaticVoidMethod(callbacks.bridgeClass, method, inputs[0], inputs[1],
                                      inputs[2]);
        }
        else if (inputs.size() == 4)
        {
            env->CallStaticVoidMethod(callbacks.bridgeClass, method, inputs[0], inputs[1],
                                      inputs[2], inputs[3]);
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
            throw std::runtime_error("The Android debug adapter is unavailable");
        }

        jstring  input = toJavaString(env, argument);
        jboolean output = env->CallStaticBooleanMethod(callbacks.bridgeClass, method, input);
        std::string failure =
            env->ExceptionCheck() ? takeJavaFailure(env, "The Android debug operation failed") : "";
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

        auto output =
            static_cast<jstring>(env->CallStaticObjectMethod(callbacks.bridgeClass, method));
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
        if (!value.isString())
        {
            throw std::invalid_argument("Java names must be strings");
        }

        std::string name = value.getString(runtime).utf8(runtime);
        if (name.empty() || name.size() > kMaximumJavaNameBytes)
        {
            throw std::invalid_argument("Java names must be 1 to 256 bytes");
        }

        return name;
    }

    static std::string serializeJavaHandle(jsi::Runtime &runtime, const jsi::Value &value)
    {
        if (!value.isObject() || value.isNull())
        {
            throw std::invalid_argument("a Java handle is required");
        }

        jsi::Object handle = value.asObject(runtime);
        if (handle.isArray(runtime))
        {
            throw std::invalid_argument("a Java handle must be a plain object");
        }

        jsi::Value id = handle.getProperty(runtime, "id");
        if (!id.isString())
        {
            jsi::Value tag = handle.getProperty(runtime, "type");
            jsi::Value tagged = handle.getProperty(runtime, "value");
            if (tag.isString() && tag.getString(runtime).utf8(runtime) == "handle" &&
                tagged.isString())
            {
                id = std::move(tagged);
            }
        }

        if (!id.isString())
        {
            throw std::invalid_argument("a Java handle must contain a string id");
        }

        std::string identifier = id.getString(runtime).utf8(runtime);
        if (identifier.empty() || identifier.size() > 128)
        {
            throw std::invalid_argument("a Java handle id must be 1 to 128 bytes");
        }

        return nlohmann::json({ { "id", identifier } }).dump();
    }

    static std::string serializeJavaArguments(jsi::Runtime &runtime, const jsi::Value *args,
                                              size_t count, size_t index)
    {
        nlohmann::json arguments = nlohmann::json::array();
        if (count > index)
        {
            const jsi::Value &value = args[index];
            if (!value.isObject() || !value.asObject(runtime).isArray(runtime))
            {
                throw std::invalid_argument("Java arguments must be an array");
            }

            jsi::Array array = value.asObject(runtime).asArray(runtime);
            if (array.size(runtime) > kMaximumJavaArgumentCount)
            {
                throw std::invalid_argument("Java calls accept at most 16 arguments");
            }

            size_t entries = 0;
            for (size_t position = 0; position < array.size(runtime); position++)
            {
                arguments.push_back(serializeNativeValue(
                    runtime, array.getValueAtIndex(runtime, position), 0, entries));
            }
        }

        std::string serialized = arguments.dump();
        if (serialized.size() > kMaximumJavaArgumentBytes)
        {
            throw std::invalid_argument("Java arguments exceed 16384 bytes");
        }

        return serialized;
    }

    static std::string serializeJavaValue(jsi::Runtime &runtime, const jsi::Value &value)
    {
        size_t         entries = 0;
        nlohmann::json result = serializeNativeValue(runtime, value, 0, entries);
        std::string    serialized = result.dump();
        if (serialized.size() > kMaximumJavaArgumentBytes)
        {
            throw std::invalid_argument("Java values exceed 16384 bytes");
        }

        return serialized;
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

    static jsi::Value guardedAsync(jsi::Runtime &runtime, std::function<std::string()> work)
    {
        auto response = std::make_shared<std::string>();
        auto failure = std::make_shared<std::string>();

        return loader::native::executeMainAsynchronously(
            runtime,
            [work = std::move(work), response, failure]() {
                try
                {
                    *response = work();
                }
                catch (const loader::native::NativeCodedError &error)
                {
                    *failure = error.what();
                }
                catch (const std::exception &error)
                {
                    *failure = error.what();
                }
                catch (...)
                {
                    *failure = "The Android operation failed";
                }
            },
            [response, failure](jsi::Runtime &completion) -> jsi::Value {
                if (!failure->empty())
                {
                    return javaFailure(completion, "NATIVE_BRIDGE_ERROR", *failure);
                }

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

    static std::mutex                                            gHookMutex;
    static std::unordered_map<std::string, std::shared_ptr<jsi::Function>> gHookListeners;

    void dispatchHookEvent(const std::string &token, const std::string &payload)
    {
        std::shared_ptr<jsi::Function> listener;
        {
            std::lock_guard<std::mutex> lock(gHookMutex);
            auto                        found = gHookListeners.find(token);
            if (found == gHookListeners.end())
            {
                return;
            }
            listener = found->second;
        }

        loader::native::executeRuntimeAsynchronously(
            [listener, payload](jsi::Runtime &runtime) {
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

        auto stored = std::make_shared<jsi::Function>(
            listener.asObject(runtime).asFunction(runtime));
        std::lock_guard<std::mutex> lock(gHookMutex);
        gHookListeners[token] = std::move(stored);
    }

    static void forgetHookListener(const std::string &token)
    {
        std::lock_guard<std::mutex> lock(gHookMutex);
        gHookListeners.erase(token);
    }

    static std::string hookTokenId(jsi::Runtime &runtime, const jsi::Value &value)
    {
        if (!value.isObject())
        {
            throw std::invalid_argument("a hook token is required");
        }

        jsi::Value id = value.asObject(runtime).getProperty(runtime, "id");
        if (!id.isString())
        {
            throw std::invalid_argument("a hook token must contain a string id");
        }

        return id.getString(runtime).utf8(runtime);
    }

    void registerNativePluginBridge(jsi::Runtime &runtime, const JavaCallbacks &callbacks)
    {
        jsi::Object bridge(runtime);
        bridge.setProperty(runtime, "apiVersion",
                           jsi::String::createFromUtf8(runtime, loader::kNativePluginApiVersion));
        bridge.setProperty(runtime, "abiVersion",
                           jsi::String::createFromUtf8(runtime, loader::kNativePluginAbiVersion));

        const char *capabilityNames[] = {
            "native.ui.lookup",       "native.ui.layout",      "native.ui.mount",
            "native.runtime.events",  "native.java.classes",   "native.java.invoke",
            "native.java.invokeAsync", "native.java.fields",   "native.java.construct",
            "native.java.hooks",     "native.java.batch",     "native.java.associations",
            "native.debug.evaluations", "native.debug.environment",
            "native.fabric.mount",   "native.fabric.async",
            "native.ffi.symbols",    "native.ffi.call",
        };
        jsi::Array capabilities(runtime, std::size(capabilityNames));
        for (size_t index = 0; index < std::size(capabilityNames); index++)
        {
            capabilities.setValueAtIndex(
                runtime, index, jsi::String::createFromUtf8(runtime, capabilityNames[index]));
        }
        bridge.setProperty(runtime, "capabilities", std::move(capabilities));

        jsi::Object ui(runtime);
        ui.setProperty(
            runtime, "lookup",
            loader::native::makeFunction(runtime, "lookup", 1,
                                         [callbacks](jsi::Runtime &rt, const jsi::Value &,
                                                     const jsi::Value *args,
                                                     size_t count) -> jsi::Value {
                                             return queryUI(rt, args, count, callbacks,
                                                            callbacks.lookupViews);
                                         }));
        ui.setProperty(
            runtime, "snapshot",
            loader::native::makeFunction(runtime, "snapshot", 1,
                                         [callbacks](jsi::Runtime &rt, const jsi::Value &,
                                                     const jsi::Value *args,
                                                     size_t count) -> jsi::Value {
                                             return queryUI(rt, args, count, callbacks,
                                                            callbacks.snapshotViews);
                                         }));
        ui.setProperty(
            runtime, "measure",
            loader::native::makeFunction(runtime, "measure", 1,
                                         [callbacks](jsi::Runtime &rt, const jsi::Value &,
                                                     const jsi::Value *args,
                                                     size_t count) -> jsi::Value {
                                             return measureUI(rt, args, count, callbacks);
                                         }));
        ui.setProperty(
            runtime, "setFrame",
            loader::native::makeFunction(runtime, "setFrame", 2,
                                         [callbacks](jsi::Runtime &rt, const jsi::Value &,
                                                     const jsi::Value *args,
                                                     size_t count) -> jsi::Value {
                                             return setFrameUI(rt, args, count, callbacks);
                                         }));
        ui.setProperty(
            runtime, "mount",
            loader::native::makeFunction(runtime, "mount", 3,
                                         [callbacks](jsi::Runtime &rt, const jsi::Value &,
                                                     const jsi::Value *args,
                                                     size_t count) -> jsi::Value {
                                             return mountUI(rt, args, count, callbacks);
                                         }));
        ui.setProperty(
            runtime, "update",
            loader::native::makeFunction(runtime, "update", 2,
                                         [callbacks](jsi::Runtime &rt, const jsi::Value &,
                                                     const jsi::Value *args,
                                                     size_t count) -> jsi::Value {
                                             return updateUI(rt, args, count, callbacks);
                                         }));
        ui.setProperty(
            runtime, "unmount",
            loader::native::makeFunction(runtime, "unmount", 1,
                                         [callbacks](jsi::Runtime &rt, const jsi::Value &,
                                                     const jsi::Value *args,
                                                     size_t count) -> jsi::Value {
                                             return unmountUI(rt, args, count, callbacks);
                                         }));
        bridge.setProperty(runtime, "ui", std::move(ui));

        jsi::Object java(runtime);
        java.setProperty(
            runtime, "getClass",
            loader::native::makeFunction(
                runtime, "getClass", 1,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                            size_t count) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        if (count < 1)
                        {
                            loader::native::throwCoded(rt, "NATIVE_BRIDGE_ERROR",
                                                       "Java class lookup requires a class name");
                        }
                        return javaSynchronously(rt, callbacks, callbacks.javaGetClass,
                                                 {javaName(rt, args[0])});
                    });
                }));
        java.setProperty(
            runtime, "className",
            loader::native::makeFunction(
                runtime, "className", 1,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                            size_t count) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        if (count < 1)
                        {
                            loader::native::throwCoded(rt, "NATIVE_BRIDGE_ERROR",
                                                       "Java class names require a handle");
                        }
                        return javaSynchronously(rt, callbacks, callbacks.javaClassName,
                                                 {serializeJavaHandle(rt, args[0])});
                    });
                }));
        java.setProperty(
            runtime, "construct",
            loader::native::makeFunction(
                runtime, "construct", 2,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                            size_t count) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        if (count < 1)
                        {
                            loader::native::throwCoded(rt, "NATIVE_BRIDGE_ERROR",
                                                       "Java construction requires a class name");
                        }
                        return javaSynchronously(
                            rt, callbacks, callbacks.javaConstruct,
                            {javaName(rt, args[0]), serializeJavaArguments(rt, args, count, 1)});
                    });
                }));
        java.setProperty(
            runtime, "respondsTo",
            loader::native::makeFunction(
                runtime, "respondsTo", 3,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                            size_t count) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        if (count < 2)
                        {
                            loader::native::throwCoded(
                                rt, "NATIVE_BRIDGE_ERROR",
                                "Java method probes require a handle and a method name");
                        }
                        return javaSynchronously(rt, callbacks, callbacks.javaRespondsTo,
                                                 {serializeJavaHandle(rt, args[0]),
                                                  javaName(rt, args[1]),
                                                  serializeJavaArguments(rt, args, count, 2)});
                    });
                }));
        java.setProperty(
            runtime, "invoke",
            loader::native::makeFunction(
                runtime, "invoke", 3,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                            size_t count) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        if (count < 2)
                        {
                            loader::native::throwCoded(
                                rt, "NATIVE_BRIDGE_ERROR",
                                "Java invocation requires a handle and a method name");
                        }
                        return javaSynchronously(rt, callbacks, callbacks.javaInvoke,
                                                 {serializeJavaHandle(rt, args[0]),
                                                  javaName(rt, args[1]),
                                                  serializeJavaArguments(rt, args, count, 2)});
                    });
                }));
        java.setProperty(
            runtime, "invokeAsync",
            loader::native::makeFunction(
                runtime, "invokeAsync", 3,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                            size_t count) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        if (count < 2)
                        {
                            loader::native::throwCoded(
                                rt, "NATIVE_BRIDGE_ERROR",
                                "Java invocation requires a handle and a method name");
                        }

                        std::vector<std::string> arguments{serializeJavaHandle(rt, args[0]),
                                                           javaName(rt, args[1]),
                                                           serializeJavaArguments(rt, args, count, 2)};
                        auto                     response = std::make_shared<std::string>();
                        return loader::native::executeMainAsynchronously(
                            rt,
                            [callbacks, arguments = std::move(arguments), response]() {
                                *response =
                                    callJavaString(callbacks, callbacks.javaInvoke, arguments);
                            },
                            [response](jsi::Runtime &completion) -> jsi::Value {
                                return parseJavaResult(completion, *response);
                            });
                    });
                }));
        java.setProperty(
            runtime, "getField",
            loader::native::makeFunction(
                runtime, "getField", 2,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                            size_t count) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        if (count < 2)
                        {
                            loader::native::throwCoded(
                                rt, "NATIVE_BRIDGE_ERROR",
                                "Java field reads require a handle and a field name");
                        }
                        return javaSynchronously(
                            rt, callbacks, callbacks.javaGetField,
                            {serializeJavaHandle(rt, args[0]), javaName(rt, args[1])});
                    });
                }));
        java.setProperty(
            runtime, "setField",
            loader::native::makeFunction(
                runtime, "setField", 3,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                            size_t count) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        if (count < 3)
                        {
                            loader::native::throwCoded(
                                rt, "NATIVE_BRIDGE_ERROR",
                                "Java field writes require a handle, a field name and a value");
                        }
                        callJavaVoid(callbacks, callbacks.javaSetField,
                                     {serializeJavaHandle(rt, args[0]), javaName(rt, args[1]),
                                      serializeJavaValue(rt, args[2])});
                        return jsi::Value::undefined();
                    });
                }));
        java.setProperty(
            runtime, "release",
            loader::native::makeFunction(
                runtime, "release", 1,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                            size_t count) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        if (count < 1)
                        {
                            loader::native::throwCoded(rt, "NATIVE_BRIDGE_ERROR",
                                                       "Java handle release requires a handle");
                        }
                        callJavaVoid(callbacks, callbacks.javaRelease,
                                     {serializeJavaHandle(rt, args[0])});
                        return jsi::Value::undefined();
                    });
                }));
        java.setProperty(
            runtime, "batch",
            loader::native::makeFunction(
                runtime, "batch", 1,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                            size_t count) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        if (count < 1)
                        {
                            throw std::invalid_argument("a Java batch requires an operation list");
                        }

                        return parseJavaResult(
                            rt, callJavaString(callbacks, callbacks.javaBatch,
                                               {serializeJavaArguments(rt, args, count, 0)}));
                    });
                }));
        java.setProperty(
            runtime, "createAssociationKey",
            loader::native::makeFunction(
                runtime, "createAssociationKey", 0,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *,
                            size_t) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        return parseJavaResult(rt, callJavaStringNoArguments(
                                                       callbacks, callbacks.javaCreateAssociationKey));
                    });
                }));
        java.setProperty(
            runtime, "getAssociatedObject",
            loader::native::makeFunction(
                runtime, "getAssociatedObject", 2,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                            size_t count) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        if (count < 2)
                        {
                            throw std::invalid_argument(
                                "reading an association requires a handle and a key");
                        }

                        return parseJavaResult(
                            rt, callJavaString(callbacks, callbacks.javaGetAssociatedObject,
                                               {serializeJavaHandle(rt, args[0]),
                                                serializeJavaHandle(rt, args[1])}));
                    });
                }));
        java.setProperty(
            runtime, "setAssociatedObject",
            loader::native::makeFunction(
                runtime, "setAssociatedObject", 3,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                            size_t count) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        if (count < 3)
                        {
                            throw std::invalid_argument(
                                "writing an association requires a handle, a key and a value");
                        }

                        callJavaVoid(callbacks, callbacks.javaSetAssociatedObject,
                                     {serializeJavaHandle(rt, args[0]),
                                      serializeJavaHandle(rt, args[1]),
                                      serializeJavaValue(rt, args[2])});
                        return jsi::Value::undefined();
                    });
                }));
        bridge.setProperty(runtime, "java", std::move(java));

        jsi::Object ffi(runtime);
        ffi.setProperty(runtime, "symbol",
                        loader::native::makeFunction(
                            runtime, "symbol", 2,
                            [](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                               size_t count) -> jsi::Value {
                                return guardJava(rt, [&] { return loader::ffi::lookupSymbol(rt, args, count); });
                            }));
        ffi.setProperty(runtime, "call",
                        loader::native::makeFunction(
                            runtime, "call", 3,
                            [](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                               size_t count) -> jsi::Value {
                                return guardJava(rt, [&] { return loader::ffi::callFunction(rt, args, count); });
                            }));
        bridge.setProperty(runtime, "ffi", std::move(ffi));

        jsi::Object hooks(runtime);
        hooks.setProperty(
            runtime, "hook",
            loader::native::makeFunction(
                runtime, "hook", 5,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                            size_t count) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        if (count < 3)
                        {
                            throw std::invalid_argument(
                                "hooks require a class name, a method name and parameter types");
                        }

                        std::string parameters = serializeJavaArguments(rt, args, count, 2);
                        std::string options = count > 3 && args[3].isObject()
                                                  ? serializeJavaValue(rt, args[3])
                                                  : std::string("{}");
                        std::string token = callJavaString(
                            callbacks, callbacks.hooksInstall,
                            {javaName(rt, args[0]), javaName(rt, args[1]), parameters, options});

                        nlohmann::json parsed = nlohmann::json::parse(token, nullptr, false);
                        if (parsed.is_discarded() || !parsed.contains("id"))
                        {
                            throw std::runtime_error("The Android hook adapter returned no token");
                        }

                        if (count > 4)
                        {
                            rememberHookListener(rt, parsed["id"].get<std::string>(), args[4]);
                        }

                        return loader::toJSIValue(rt, parsed);
                    });
                }));
        hooks.setProperty(
            runtime, "remove",
            loader::native::makeFunction(
                runtime, "remove", 1,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                            size_t count) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        if (count < 1)
                        {
                            throw std::invalid_argument("removing a hook requires its token");
                        }

                        forgetHookListener(hookTokenId(rt, args[0]));
                        callJavaVoid(callbacks, callbacks.hooksRemove,
                                     {serializeJavaHandle(rt, args[0])});
                        return jsi::Value::undefined();
                    });
                }));
        hooks.setProperty(
            runtime, "setReturnValue",
            loader::native::makeFunction(
                runtime, "setReturnValue", 4,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                            size_t count) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        if (count < 4)
                        {
                            throw std::invalid_argument(
                                "a cached hook result requires a token, a receiver, arguments and "
                                "a value");
                        }

                        callJavaVoid(callbacks, callbacks.hooksSetReturnValue,
                                     {serializeJavaHandle(rt, args[0]),
                                      serializeJavaValue(rt, args[1]),
                                      serializeJavaArguments(rt, args, count, 2),
                                      serializeJavaValue(rt, args[3])});
                        return jsi::Value::undefined();
                    });
                }));
        hooks.setProperty(
            runtime, "removeReturnValue",
            loader::native::makeFunction(
                runtime, "removeReturnValue", 3,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                            size_t count) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        if (count < 3)
                        {
                            throw std::invalid_argument(
                                "removing a cached hook result requires a token, a receiver and "
                                "arguments");
                        }

                        callJavaVoid(callbacks, callbacks.hooksRemoveReturnValue,
                                     {serializeJavaHandle(rt, args[0]),
                                      serializeJavaValue(rt, args[1]),
                                      serializeJavaArguments(rt, args, count, 2)});
                        return jsi::Value::undefined();
                    });
                }));
        hooks.setProperty(
            runtime, "clearReturnValues",
            loader::native::makeFunction(
                runtime, "clearReturnValues", 1,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                            size_t count) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        if (count < 1)
                        {
                            throw std::invalid_argument(
                                "clearing cached hook results requires a token");
                        }

                        callJavaVoid(callbacks, callbacks.hooksClearReturnValues,
                                     {serializeJavaHandle(rt, args[0])});
                        return jsi::Value::undefined();
                    });
                }));
        bridge.setProperty(runtime, "hooks", std::move(hooks));

        jsi::Object debug(runtime);
        debug.setProperty(
            runtime, "recordEvaluation",
            loader::native::makeFunction(
                runtime, "recordEvaluation", 1,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                            size_t count) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        if (count < 1)
                        {
                            throw std::invalid_argument("expected an evaluation record");
                        }

                        return jsi::Value(callJavaBoolean(callbacks, callbacks.debugRecordEvaluation,
                                                          serializeJavaValue(rt, args[0])));
                    });
                }));
        debug.setProperty(
            runtime, "environment",
            loader::native::makeFunction(
                runtime, "environment", 0,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *,
                            size_t) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        return parseJavaResult(
                            rt, callJavaStringNoArguments(callbacks, callbacks.debugEnvironment));
                    });
                }));
        bridge.setProperty(runtime, "debug", std::move(debug));

        jsi::Object surfaces(runtime);
        surfaces.setProperty(
            runtime, "mount",
            loader::native::makeFunction(
                runtime, "mount", 3,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                            size_t count) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        if (count < 2)
                        {
                            return javaFailure(
                                rt, "NATIVE_BRIDGE_ERROR",
                                "Mounting a React surface requires a container and a module name");
                        }

                        std::string container = std::string("{}");
                        if (args[0].isObject())
                        {
                            jsi::Object candidate = args[0].asObject(rt);
                            if (candidate.getProperty(rt, "id").isString() ||
                                candidate.getProperty(rt, "value").isString())
                            {
                                container = serializeJavaHandle(rt, args[0]);
                            }
                        }
                        std::string moduleName = javaName(rt, args[1]);
                        std::string properties = count > 2 && args[2].isObject()
                                                     ? serializeNativeProperties(rt, args[2])
                                                     : std::string("{}");
                        return guardedAsync(rt, [callbacks, container = std::move(container),
                                                 moduleName = std::move(moduleName),
                                                 properties = std::move(properties)]() {
                            return callJavaString(callbacks, callbacks.fabricMount,
                                                  {container, moduleName, properties});
                        });
                    });
                }));
        surfaces.setProperty(
            runtime, "update",
            loader::native::makeFunction(
                runtime, "update", 2,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                            size_t count) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        if (count < 2)
                        {
                            loader::native::throwCoded(
                                rt, "NATIVE_BRIDGE_ERROR",
                                "Updating a React surface requires a handle and properties");
                        }

                        std::string handle = serializeJavaHandle(rt, args[0]);
                        std::string properties = serializeNativeProperties(rt, args[1]);
                        return guardedAsync(rt, [callbacks, handle = std::move(handle),
                                                 properties = std::move(properties)]() {
                            callJavaVoid(callbacks, callbacks.fabricUpdate, {handle, properties});
                            return std::string();
                        });
                    });
                }));
        surfaces.setProperty(
            runtime, "unmount",
            loader::native::makeFunction(
                runtime, "unmount", 1,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                            size_t count) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        if (count < 1)
                        {
                            loader::native::throwCoded(rt, "NATIVE_BRIDGE_ERROR",
                                                       "Unmounting a React surface requires a handle");
                        }

                        std::string handle = serializeJavaHandle(rt, args[0]);
                        return guardedAsync(rt, [callbacks, handle = std::move(handle)]() {
                            callJavaVoid(callbacks, callbacks.fabricUnmount, {handle});
                            return std::string();
                        });
                    });
                }));
        surfaces.setProperty(
            runtime, "isRunning",
            loader::native::makeFunction(
                runtime, "isRunning", 1,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                            size_t count) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        if (count < 1)
                        {
                            throw std::invalid_argument(
                                "reading a React surface requires a handle");
                        }

                        return parseJavaResult(
                            rt, callJavaString(callbacks, callbacks.fabricIsRunning,
                                               {serializeJavaHandle(rt, args[0])}));
                    });
                }));
        surfaces.setProperty(
            runtime, "view",
            loader::native::makeFunction(
                runtime, "view", 1,
                [callbacks](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                            size_t count) -> jsi::Value {
                    return guardJava(rt, [&]() -> jsi::Value {
                        if (count < 1)
                        {
                            throw std::invalid_argument(
                                "reading a React surface view requires a handle");
                        }

                        return parseJavaResult(
                            rt, callJavaString(callbacks, callbacks.fabricViewHandle,
                                               {serializeJavaHandle(rt, args[0])}));
                    });
                }));
        bridge.setProperty(runtime, "surfaces", std::move(surfaces));

        runtime.global().setProperty(runtime, "NativePlugin", std::move(bridge));
    }
}
