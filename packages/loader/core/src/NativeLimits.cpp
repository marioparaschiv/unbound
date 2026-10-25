#include "NativeLimits.h"

#include <stdexcept>

namespace loader::native {
namespace jsi = facebook::jsi;

std::string parseName(const std::string &value, size_t maximum, const char *subject)
{
    if (value.empty() || value.size() > maximum)
    {
        throw std::invalid_argument(std::string(subject) + " must be 1 to " +
                                    std::to_string(maximum) + " bytes");
    }
    return value;
}

std::string parseName(jsi::Runtime &runtime, const jsi::Value &value, size_t maximum,
                      const char *subject)
{
    if (!value.isString())
    {
        throw std::invalid_argument(std::string(subject) + " must be a string");
    }
    return parseName(value.getString(runtime).utf8(runtime), maximum, subject);
}

static const nlohmann::json *handleField(const nlohmann::json &handle)
{
    auto id = handle.find("id");
    if (id != handle.end() && id->is_string())
    {
        return &*id;
    }
    auto type  = handle.find("type");
    auto value = handle.find("value");
    if (type != handle.end() && *type == "handle" && value != handle.end() && value->is_string())
    {
        return &*value;
    }
    return nullptr;
}

std::string parseHandleId(const nlohmann::json &handle, const char *subject)
{
    if (!handle.is_object())
    {
        throw std::invalid_argument(std::string(subject) + " must be a handle object");
    }
    const nlohmann::json *id = handleField(handle);
    if (!id)
    {
        throw std::invalid_argument(std::string(subject) + " must contain a string id");
    }
    return parseName(id->get<std::string>(), kMaximumHandleIdBytes, subject);
}

std::string parseHandleId(jsi::Runtime &runtime, const jsi::Value &handle, const char *subject)
{
    if (!handle.isObject())
    {
        throw std::invalid_argument(std::string(subject) + " must be a handle object");
    }
    jsi::Object    object = handle.asObject(runtime);
    nlohmann::json fields = nlohmann::json::object();
    for (const char *key : {"id", "type", "value"})
    {
        jsi::Value field = object.getProperty(runtime, key);
        if (field.isString())
        {
            fields[key] = field.getString(runtime).utf8(runtime);
        }
    }
    return parseHandleId(fields, subject);
}

std::string handleJSON(const std::string &id)
{
    return nlohmann::json({{"id", id}}).dump();
}
}
