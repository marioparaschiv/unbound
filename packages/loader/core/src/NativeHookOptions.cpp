#include "NativeHookOptions.h"

#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <string>

namespace jsi = facebook::jsi;

namespace loader::native {
static const nlohmann::json *presentField(const nlohmann::json &options, const char *key)
{
    auto value = options.find(key);
    return value == options.end() ? nullptr : &*value;
}

static bool enabledFlag(const nlohmann::json &options, const char *key)
{
    const nlohmann::json *value = presentField(options, key);
    return value && value->is_boolean() && value->get<bool>();
}

static bool receiverCoalescing(const nlohmann::json &options)
{
    const nlohmann::json *value = presentField(options, "coalesce");
    if (!value || value->is_null())
    {
        return false;
    }
    if (!value->is_string() || value->get_ref<const std::string &>() != "receiver")
    {
        throw std::invalid_argument("Native hook coalescing must be set to receiver");
    }
    return true;
}

HookFlags parseHookFlags(const nlohmann::json &options)
{
    HookFlags flags;
    if (!options.is_object())
    {
        return flags;
    }
    flags.once          = enabledFlag(options, "once");
    flags.cacheOnly     = enabledFlag(options, "cacheOnly");
    flags.coalesceAfter = receiverCoalescing(options);
    return flags;
}

static std::vector<size_t> argumentIndexes(const nlohmann::json &indexes, size_t explicitArguments)
{
    if (!indexes.is_array())
    {
        throw std::invalid_argument("Native hook payload arguments must be an array");
    }
    std::vector<size_t> selected;
    selected.reserve(indexes.size());
    for (const nlohmann::json &index : indexes)
    {
        if (!index.is_number())
        {
            throw std::invalid_argument("Native hook payload argument indexes must be integers");
        }
        double requested = index.get<double>();
        if (!std::isfinite(requested) || requested < 0 || std::trunc(requested) != requested ||
            requested >= static_cast<double>(explicitArguments))
        {
            throw std::invalid_argument("Native hook payload argument index is out of range");
        }
        size_t argument = static_cast<size_t>(requested);
        if (std::find(selected.begin(), selected.end(), argument) != selected.end())
        {
            throw std::invalid_argument("Native hook payload argument indexes must be unique");
        }
        selected.push_back(argument);
    }
    return selected;
}

static HookPayloadPhase payloadPhase(const nlohmann::json &phase)
{
    if (!phase.is_string())
    {
        throw std::invalid_argument("Native hook payload phase must be a string");
    }
    const std::string &name = phase.get_ref<const std::string &>();
    if (name == "before")
    {
        return HookPayloadPhase::before;
    }
    if (name == "after")
    {
        return HookPayloadPhase::after;
    }
    throw std::invalid_argument("Native hook payload phase must be before or after");
}

HookPayload parseHookPayload(const nlohmann::json &options, size_t explicitArguments)
{
    HookPayload           payload;
    const nlohmann::json *value = options.is_object() ? presentField(options, "payload") : nullptr;
    if (!value || value->is_null())
    {
        return payload;
    }
    if (!value->is_object())
    {
        throw std::invalid_argument("Native hook payload options must be an object");
    }
    if (const nlohmann::json *receiver = presentField(*value, "receiver"))
    {
        if (!receiver->is_boolean())
        {
            throw std::invalid_argument("Native hook payload receiver must be boolean");
        }
        payload.receiver = receiver->get<bool>();
    }
    if (const nlohmann::json *indexes = presentField(*value, "arguments"))
    {
        payload.allArguments    = false;
        payload.argumentIndexes = argumentIndexes(*indexes, explicitArguments);
    }
    if (const nlohmann::json *phase = presentField(*value, "phase"))
    {
        payload.phase = payloadPhase(*phase);
    }
    return payload;
}

static nlohmann::json scalarField(jsi::Runtime &runtime, const jsi::Value &value)
{
    if (value.isNull())
    {
        return nullptr;
    }
    if (value.isNumber())
    {
        return value.getNumber();
    }
    if (value.isBool())
    {
        return value.getBool();
    }
    if (value.isString())
    {
        return value.getString(runtime).utf8(runtime);
    }
    return nlohmann::json::object();
}

static nlohmann::json scalarArray(jsi::Runtime &runtime, const jsi::Value &value)
{
    if (!value.isObject() || !value.asObject(runtime).isArray(runtime))
    {
        return scalarField(runtime, value);
    }
    jsi::Array     items  = value.asObject(runtime).asArray(runtime);
    nlohmann::json result = nlohmann::json::array();
    size_t         count  = items.size(runtime);
    for (size_t index = 0; index < count; index++)
    {
        result.push_back(scalarField(runtime, items.getValueAtIndex(runtime, index)));
    }
    return result;
}

static void copyField(jsi::Runtime &runtime, const jsi::Object &source, const char *key,
                      nlohmann::json &target,
                      nlohmann::json (*convert)(jsi::Runtime &, const jsi::Value &) = scalarField)
{
    jsi::Value value = source.getProperty(runtime, key);
    if (!value.isUndefined())
    {
        target[key] = convert(runtime, value);
    }
}

static nlohmann::json payloadField(jsi::Runtime &runtime, const jsi::Value &value)
{
    if (!value.isObject())
    {
        return scalarField(runtime, value);
    }
    jsi::Object object = value.asObject(runtime);
    if (object.isArray(runtime))
    {
        return nlohmann::json::array();
    }
    nlohmann::json fields = nlohmann::json::object();
    copyField(runtime, object, "receiver", fields);
    copyField(runtime, object, "arguments", fields, scalarArray);
    copyField(runtime, object, "phase", fields);
    return fields;
}

template <typename Parse>
static auto rethrowAsJSError(jsi::Runtime &runtime, Parse &&parse) -> decltype(parse())
{
    try
    {
        return parse();
    }
    catch (const std::invalid_argument &error)
    {
        throw jsi::JSError(runtime, error.what());
    }
}

HookFlags parseHookFlags(jsi::Runtime &runtime, const jsi::Object &options)
{
    nlohmann::json fields = nlohmann::json::object();
    copyField(runtime, options, "once", fields);
    copyField(runtime, options, "cacheOnly", fields);
    copyField(runtime, options, "coalesce", fields);
    return rethrowAsJSError(runtime, [&] {
        return parseHookFlags(fields);
    });
}

HookPayload parseHookPayload(jsi::Runtime &runtime, const jsi::Object &options,
                             size_t explicitArguments)
{
    nlohmann::json fields = nlohmann::json::object();
    copyField(runtime, options, "payload", fields, payloadField);
    return rethrowAsJSError(runtime, [&] {
        return parseHookPayload(fields, explicitArguments);
    });
}

bool cacheableHookResult(std::string_view result)
{
    return result == "bool" || result == "i8" || result == "u8" || result == "i16" ||
           result == "u16" || result == "i32" || result == "u32" || result == "i64" ||
           result == "u64" || result == "float" || result == "double" ||
           result.starts_with("struct:");
}

void validateHookHandlers(const HookHandlers &handlers, const HookFlags &flags,
                          const HookPayload &payload, std::string_view result)
{
    if (flags.coalesceAfter && (handlers.replace || !handlers.after ||
                                payload.phase == HookPayloadPhase::before || !payload.receiver))
    {
        throw std::invalid_argument(
            "Receiver coalescing requires a non-replacing after-observation hook with its receiver");
    }
    if (flags.cacheOnly &&
        (handlers.before || handlers.after || handlers.replace || !cacheableHookResult(result)))
    {
        throw std::invalid_argument(
            "Native cache-only hooks require a scalar or struct return type");
    }
}

void validateHookHandlers(jsi::Runtime &runtime, const HookHandlers &handlers,
                          const HookFlags &flags, const HookPayload &payload,
                          std::string_view result)
{
    rethrowAsJSError(runtime, [&] {
        validateHookHandlers(handlers, flags, payload, result);
    });
}

std::vector<size_t> payloadArgumentIndexes(const HookPayload &payload, size_t explicitArguments)
{
    if (!payload.allArguments)
    {
        return payload.argumentIndexes;
    }
    std::vector<size_t> indexes(explicitArguments);
    for (size_t index = 0; index < explicitArguments; index++)
    {
        indexes[index] = index;
    }
    return indexes;
}

size_t selectedPayloadArgument(double requested, size_t available)
{
    if (!(requested >= 0 && requested < available))
    {
        throw std::invalid_argument("Native hook argument index is out of range");
    }
    size_t selected = static_cast<size_t>(requested);
    if (static_cast<double>(selected) != requested)
    {
        throw std::invalid_argument("Native hook argument index must be an integer");
    }
    return selected;
}

size_t selectedPayloadArgument(jsi::Runtime &runtime, double requested, size_t available)
{
    return rethrowAsJSError(runtime, [&] {
        return selectedPayloadArgument(requested, available);
    });
}
}
