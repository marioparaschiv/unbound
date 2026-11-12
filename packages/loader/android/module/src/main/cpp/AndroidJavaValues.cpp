#include "AndroidJavaValues.h"

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

// Passes 1 to 4 string arguments to `call` as separate parameters.
template <typename Call>
static auto spreadArguments(const std::vector<std::string> &arguments, Call call)
{
    switch (arguments.size())
    {
        case 1:
            return call(arguments[0]);
        case 2:
            return call(arguments[0], arguments[1]);
        case 3:
            return call(arguments[0], arguments[1], arguments[2]);
        case 4:
            return call(arguments[0], arguments[1], arguments[2], arguments[3]);
        default:
            throw std::invalid_argument("unsupported Java adapter arity");
    }
}

std::string callJavaString(const JavaCallbacks &callbacks, jmethodID method,
                           const std::vector<std::string> &arguments)
{
    return spreadArguments(arguments, [&](const auto &...values) {
        return invokeStaticString(callbacks.bridgeClass, method, values...);
    });
}

void callJavaVoid(const JavaCallbacks &callbacks, jmethodID method,
                  const std::vector<std::string> &arguments)
{
    spreadArguments(arguments, [&](const auto &...values) {
        invokeStaticVoid(callbacks.bridgeClass, method, values...);
    });
}

std::string javaName(jsi::Runtime &runtime, const jsi::Value &value)
{
    return loader::native::parseName(runtime, value, loader::native::kMaximumNativeNameBytes,
                                     "A Java name");
}

std::string serializeJavaHandle(jsi::Runtime &runtime, const jsi::Value &value)
{
    return loader::native::handleJSON(
        loader::native::parseHandleId(runtime, value, "A Java handle"));
}

std::string serializeJavaBatch(jsi::Runtime &runtime, const jsi::Value &value)
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

void callSetAssociatedObject(const JavaCallbacks &callbacks, const std::string &handle,
                             const std::string &key, const std::string &value)
{
    invokeStaticVoid(callbacks.bridgeClass, callbacks.javaSetAssociatedObject, handle, key, value,
                     static_cast<jint>(loader::native::kMaximumAssociationsPerObject));
}

std::string serializeJavaArguments(jsi::Runtime &runtime, const jsi::Value *args, size_t count,
                                   size_t index)
{
    if (count <= index)
    {
        return "[]";
    }
    return loader::native::serializeBoundedArguments(runtime, args[index],
                                                     kNativeArgumentsConversion);
}

std::string serializeJavaParameterTypes(jsi::Runtime &runtime, const jsi::Value &value)
{
    if (!value.isObject() || !value.asObject(runtime).isArray(runtime))
    {
        throw std::invalid_argument("Java method parameter types must be an array");
    }
    jsi::Array     types = value.asObject(runtime).asArray(runtime);
    nlohmann::json names = nlohmann::json::array();
    const size_t   count = types.size(runtime);
    if (count > kMaximumNativeArguments)
    {
        throw std::invalid_argument("A prepared Java call has too many parameter types");
    }
    for (size_t index = 0; index < count; index++)
    {
        names.push_back(javaName(runtime, types.getValueAtIndex(runtime, index)));
    }
    return names.dump();
}

std::string serializeJavaValue(jsi::Runtime &runtime, const jsi::Value &value)
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
static std::optional<JavaCallbacks>                  gJavaReleaseCallbacks;

std::optional<JavaCallbacks> javaReleaseCallbacks()
{
    std::lock_guard<std::mutex> lock(gJavaLeasesMutex);
    return gJavaReleaseCallbacks;
}

void leaseJavaHandles(const JavaCallbacks &callbacks)
{
    std::lock_guard<std::mutex> lock(gJavaLeasesMutex);
    if (gJavaLeases)
    {
        return;
    }
    gJavaReleaseCallbacks = callbacks;
    gJavaLeases           = std::make_shared<loader::native::HandleLeases>(
        javaHandleId, [callbacks](const std::string &id, uint64_t issues) {
            callJavaVoid(callbacks, callbacks.javaRelease,
                         {nlohmann::json{{"id", id}, {"issues", issues}}.dump()});
        });
}

jsi::Value adoptJavaValue(jsi::Runtime &runtime, const nlohmann::json &value)
{
    std::shared_ptr<loader::native::HandleLeases> leases;
    {
        std::lock_guard<std::mutex> lock(gJavaLeasesMutex);
        leases = gJavaLeases;
    }
    return leases ? leases->adopt(runtime, value) : loader::toJSIValue(runtime, value);
}

static jsi::Value adoptTaggedJavaValue(jsi::Runtime                      &runtime,
                                       const loader::native::TaggedValue &tagged)
{
    if (tagged.kind == loader::native::TaggedValueKind::String && tagged.type == "handle" &&
        tagged.text.rfind("java-", 0) == 0)
    {
        std::shared_ptr<loader::native::HandleLeases> leases;
        {
            std::lock_guard<std::mutex> lock(gJavaLeasesMutex);
            leases = gJavaLeases;
        }
        if (leases)
        {
            return leases->adoptTaggedHandle(runtime, tagged.type, tagged.text);
        }
    }

    jsi::Object object(runtime);
    object.setProperty(runtime, "type", jsi::String::createFromUtf8(runtime, tagged.type));
    switch (tagged.kind)
    {
        case loader::native::TaggedValueKind::Null:
            object.setProperty(runtime, "value", jsi::Value::null());
            break;
        case loader::native::TaggedValueKind::Boolean:
            object.setProperty(runtime, "value", tagged.boolean);
            break;
        case loader::native::TaggedValueKind::Number:
            object.setProperty(runtime, "value", tagged.number);
            break;
        case loader::native::TaggedValueKind::String:
            object.setProperty(runtime, "value", jsi::String::createFromUtf8(runtime, tagged.text));
            break;
    }
    return object;
}

std::optional<jsi::Value> adoptTaggedJavaEvent(jsi::Runtime &runtime, const std::string &payload)
{
    std::optional<loader::native::TaggedEvent> event = loader::native::parseTaggedEvent(payload);
    if (!event)
    {
        return std::nullopt;
    }
    jsi::Array arguments(runtime, event->arguments.size());
    for (size_t index = 0; index < event->arguments.size(); index++)
    {
        arguments.setValueAtIndex(runtime, index,
                                  adoptTaggedJavaValue(runtime, event->arguments[index]));
    }
    jsi::Object object(runtime);
    object.setProperty(runtime, "args", arguments);
    if (event->self)
    {
        object.setProperty(runtime, "self", adoptTaggedJavaValue(runtime, *event->self));
    }
    jsi::Array indexes(runtime, event->argumentIndexes.size());
    for (size_t index = 0; index < event->argumentIndexes.size(); index++)
    {
        indexes.setValueAtIndex(runtime, index,
                                jsi::Value(static_cast<double>(event->argumentIndexes[index])));
    }
    object.setProperty(runtime, "argumentIndexes", indexes);
    object.setProperty(runtime, "phase", jsi::String::createFromUtf8(runtime, event->phase));
    return object;
}

jsi::Value parseJavaResult(jsi::Runtime &runtime, const std::string &response)
{
    if (std::optional<loader::native::TaggedValue> tagged =
            loader::native::parseTaggedValue(response))
    {
        return adoptTaggedJavaValue(runtime, *tagged);
    }

    nlohmann::json result = nlohmann::json::parse(response, nullptr, false);
    if (result.is_discarded())
    {
        throw std::runtime_error("The Android Java adapter returned invalid data");
    }

    return adoptJavaValue(runtime, result);
}

JavaHandleReleaser javaHandleReleaser(JavaCallbacks callbacks)
{
    return [callbacks](const std::string &id) {
        try
        {
            callJavaVoid(callbacks, callbacks.javaRelease,
                         {nlohmann::json{{"id", id}, {"issues", 1}}.dump()});
        }
        catch (const std::exception &error)
        {
            loader::log(loader::LogLevel::Error, LOG_CATEGORY_PLUGINS,
                        std::string("Failed to release an undelivered Java handle: ") +
                            error.what());
        }
        catch (...)
        {
            loader::log(loader::LogLevel::Error, LOG_CATEGORY_PLUGINS,
                        "Failed to release an undelivered Java handle.");
        }
    };
}

std::shared_ptr<PendingJavaPayload> pendingJavaPayload(const JavaCallbacks &callbacks,
                                                       std::string          payload)
{
    return std::make_shared<PendingJavaPayload>(
        javaHandleReleaser(callbacks), loader::native::runtimeGeneration, std::move(payload));
}

jsi::Value javaAsynchronously(jsi::Runtime &runtime, const JavaCallbacks &callbacks,
                              std::function<std::string()> work)
{
    auto response = pendingJavaPayload(callbacks);
    return loader::native::executeMainAsynchronously(
        runtime,
        [work = std::move(work), response]() {
            response->receive(work());
        },
        [response](jsi::Runtime &completion) -> jsi::Value {
            std::string payload = response->take();
            if (payload.empty())
            {
                return jsi::Value::undefined();
            }
            return parseJavaResult(completion, payload);
        });
}

jsi::Value javaSynchronously(jsi::Runtime &runtime, const JavaCallbacks &callbacks,
                             jmethodID method, const std::vector<std::string> &arguments)
{
    return parseJavaResult(runtime, callJavaString(callbacks, method, arguments));
}
}
