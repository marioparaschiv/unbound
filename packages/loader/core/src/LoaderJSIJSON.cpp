#include "LoaderJSIJSON.h"

#include <stdexcept>

#include "LoaderJSON.h"

namespace loader {
namespace jsi = facebook::jsi;

jsi::Value toJSIValue(jsi::Runtime &runtime, const nlohmann::json &value)
{
    switch (value.type())
    {
        case nlohmann::json::value_t::null:
        case nlohmann::json::value_t::discarded:
            return jsi::Value::null();
        case nlohmann::json::value_t::boolean:
            return jsi::Value(value.get<bool>());
        case nlohmann::json::value_t::number_integer:
        case nlohmann::json::value_t::number_unsigned:
        case nlohmann::json::value_t::number_float:
            return jsi::Value(value.get<double>());
        case nlohmann::json::value_t::string:
            return jsi::String::createFromUtf8(runtime, withValidUTF8(value.get<std::string>()));
        case nlohmann::json::value_t::array: {
            jsi::Array array(runtime, value.size());
            for (size_t index = 0; index < value.size(); index++)
            {
                array.setValueAtIndex(runtime, index, toJSIValue(runtime, value[index]));
            }
            return array;
        }
        case nlohmann::json::value_t::object: {
            jsi::Object object(runtime);
            for (auto entry = value.begin(); entry != value.end(); ++entry)
            {
                object.setProperty(runtime,
                                   jsi::PropNameID::forUtf8(runtime, withValidUTF8(entry.key())),
                                   toJSIValue(runtime, entry.value()));
            }
            return object;
        }
        case nlohmann::json::value_t::binary:
            return jsi::Value::undefined();
    }
    return jsi::Value::undefined();
}

static constexpr size_t kMaximumConvertedDepth = 128;

static nlohmann::json convertJSIValue(jsi::Runtime &runtime, const jsi::Value &value, size_t depth)
{
    if (value.isUndefined() || value.isNull())
    {
        return nullptr;
    }
    if (value.isBool())
    {
        return value.getBool();
    }
    if (value.isNumber())
    {
        return value.getNumber();
    }
    if (value.isString())
    {
        return value.getString(runtime).utf8(runtime);
    }
    if (!value.isObject())
    {
        return nullptr;
    }

    if (depth > kMaximumConvertedDepth)
    {
        throw std::invalid_argument("Native value nests deeper than " +
                                    std::to_string(kMaximumConvertedDepth) +
                                    " levels or refers to itself");
    }

    jsi::Object object = value.getObject(runtime);
    if (object.isArray(runtime))
    {
        jsi::Array     array  = object.getArray(runtime);
        nlohmann::json result = nlohmann::json::array();
        for (size_t index = 0; index < array.size(runtime); index++)
        {
            result.push_back(
                convertJSIValue(runtime, array.getValueAtIndex(runtime, index), depth + 1));
        }
        return result;
    }

    if (object.isFunction(runtime))
    {
        return nullptr;
    }

    nlohmann::json result = nlohmann::json::object();
    jsi::Array     names  = object.getPropertyNames(runtime);
    for (size_t index = 0; index < names.size(runtime); index++)
    {
        std::string name = names.getValueAtIndex(runtime, index).getString(runtime).utf8(runtime);
        result[name] =
            convertJSIValue(runtime, object.getProperty(runtime, name.c_str()), depth + 1);
    }
    return result;
}

nlohmann::json fromJSIValue(jsi::Runtime &runtime, const jsi::Value &value)
{
    return convertJSIValue(runtime, value, 1);
}
}
