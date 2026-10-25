#include "NativeBoundedValue.h"

#include <cmath>
#include <stdexcept>

namespace loader::native {
namespace jsi = facebook::jsi;

class BudgetScope
{
public:
    explicit BudgetScope(NativeConversionBudget &budget) : budget_(budget)
    {
        if (!budget_.enter())
        {
            throw std::invalid_argument("Native value exceeds its nesting or entry limit");
        }
    }

    ~BudgetScope()
    {
        budget_.leave();
    }

private:
    NativeConversionBudget &budget_;
};

static void reserve(NativeConversionBudget &budget, size_t count)
{
    if (!budget.reserveEntries(count))
    {
        throw std::invalid_argument("Native value exceeds its entry limit");
    }
}

static std::string boundedString(jsi::Runtime &runtime, const jsi::Value &value,
                                 NativeConversionBudget &budget)
{
    std::string text = value.getString(runtime).utf8(runtime);
    if (!budget.addString(text.size()))
    {
        throw std::invalid_argument("Native value strings exceed their byte limit");
    }
    return text;
}

nlohmann::json serializeBounded(jsi::Runtime &runtime, const jsi::Value &value,
                                NativeConversionBudget &budget)
{
    BudgetScope scope(budget);
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
            throw std::invalid_argument("Native value numbers must be finite");
        }
        return number;
    }
    if (value.isString())
    {
        return boundedString(runtime, value, budget);
    }
    if (!value.isObject())
    {
        throw std::invalid_argument(
            "Native values must be null, booleans, numbers, strings, arrays or objects");
    }

    jsi::Object object = value.asObject(runtime);
    if (object.isHostObject(runtime))
    {
        throw std::invalid_argument("Native object handles cannot be serialized");
    }
    if (object.isFunction(runtime))
    {
        throw std::invalid_argument("Functions cannot be serialized as native values");
    }

    if (object.isArray(runtime))
    {
        jsi::Array array = object.asArray(runtime);
        size_t     count = array.size(runtime);
        reserve(budget, count);
        nlohmann::json result = nlohmann::json::array();
        for (size_t index = 0; index < count; index++)
        {
            jsi::Value element = array.getValueAtIndex(runtime, index);
            result.push_back(element.isUndefined() ? nlohmann::json(nullptr)
                                                   : serializeBounded(runtime, element, budget));
        }
        return result;
    }

    jsi::Array names = object.getPropertyNames(runtime);
    size_t     count = names.size(runtime);
    reserve(budget, count);
    nlohmann::json result = nlohmann::json::object();
    for (size_t index = 0; index < count; index++)
    {
        jsi::Value nameValue = names.getValueAtIndex(runtime, index);
        if (!nameValue.isString())
        {
            throw std::invalid_argument("Native value property names must be strings");
        }
        std::string name     = nameValue.getString(runtime).utf8(runtime);
        jsi::Value  property = object.getProperty(runtime, name.c_str());
        if (property.isUndefined())
        {
            continue;
        }
        if (!budget.addName(name.size()))
        {
            throw std::invalid_argument("Native value property names must be 1 to " +
                                        std::to_string(budget.profile().maximumNameBytes) +
                                        " bytes");
        }
        result[name] = serializeBounded(runtime, property, budget);
    }
    return result;
}

std::string dumpBounded(const nlohmann::json &value, const NativeConversionProfile &profile)
{
    std::string serialized = value.dump();
    if (serialized.size() > profile.maximumBytes)
    {
        throw std::invalid_argument("Native value exceeds " + std::to_string(profile.maximumBytes) +
                                    " serialized bytes");
    }
    return serialized;
}

std::string serializeBounded(jsi::Runtime &runtime, const jsi::Value &value,
                             const NativeConversionProfile &profile)
{
    NativeConversionBudget budget(profile);
    return dumpBounded(serializeBounded(runtime, value, budget), profile);
}

static bool isPlainObject(jsi::Runtime &runtime, const jsi::Value &value)
{
    if (!value.isObject())
    {
        return false;
    }
    jsi::Object object = value.asObject(runtime);
    return !object.isArray(runtime) && !object.isHostObject(runtime) && !object.isFunction(runtime);
}

std::string serializeBoundedObject(jsi::Runtime &runtime, const jsi::Value &value,
                                   const NativeConversionProfile &profile)
{
    if (!isPlainObject(runtime, value))
    {
        throw std::invalid_argument("Native properties must be a plain object");
    }
    return serializeBounded(runtime, value, profile);
}

std::string serializeBoundedArguments(jsi::Runtime &runtime, const jsi::Value &value,
                                      const NativeConversionProfile &profile)
{
    if (!value.isObject() || !value.asObject(runtime).isArray(runtime))
    {
        throw std::invalid_argument("Native arguments must be an array");
    }
    if (value.asObject(runtime).asArray(runtime).size(runtime) > kMaximumNativeArguments)
    {
        throw std::invalid_argument("Native calls accept at most " +
                                    std::to_string(kMaximumNativeArguments) + " arguments");
    }
    return serializeBounded(runtime, value, profile);
}

nlohmann::json serializeBoundedBatch(jsi::Runtime &runtime, const jsi::Value &value,
                                     size_t maximumSteps)
{
    if (!value.isObject() || !value.asObject(runtime).isArray(runtime))
    {
        throw std::invalid_argument("A native batch must be an array of steps");
    }
    if (value.asObject(runtime).asArray(runtime).size(runtime) > maximumSteps)
    {
        throw std::invalid_argument("Native batch requires at most " +
                                    std::to_string(maximumSteps) + " steps");
    }
    NativeConversionBudget budget(kNativeBatchConversion);
    nlohmann::json         steps = serializeBounded(runtime, value, budget);
    dumpBounded(steps, kNativeBatchConversion);
    return steps;
}
}
