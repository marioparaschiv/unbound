#include "NativeBatchReferences.h"

#include <stdexcept>

namespace jsi = facebook::jsi;

namespace loader::native {
static constexpr const char *kIndexNotNumber = "Native batch result index must be an integer";

size_t batchReferenceIndex(double index, size_t stepIndex)
{
    if (!(index >= 0 && index < stepIndex) ||
        static_cast<double>(static_cast<size_t>(index)) != index)
    {
        throw std::invalid_argument("Native batch can only reference earlier results");
    }
    return static_cast<size_t>(index);
}

std::optional<size_t> batchResultIndex(const nlohmann::json &value, size_t stepIndex)
{
    if (!value.is_object())
    {
        return std::nullopt;
    }
    auto reference = value.find(kNativeBatchResultKey);
    if (reference == value.end())
    {
        return std::nullopt;
    }
    if (!reference->is_number())
    {
        throw std::invalid_argument(kIndexNotNumber);
    }
    return batchReferenceIndex(reference->get<double>(), stepIndex);
}

std::optional<size_t> batchResultIndex(jsi::Runtime &runtime, const jsi::Value &value,
                                       size_t stepIndex)
{
    if (!value.isObject())
    {
        return std::nullopt;
    }
    jsi::Value reference = value.asObject(runtime).getProperty(runtime, kNativeBatchResultKey);
    if (reference.isUndefined())
    {
        return std::nullopt;
    }
    if (!reference.isNumber())
    {
        throw jsi::JSError(runtime, kIndexNotNumber);
    }
    try
    {
        return batchReferenceIndex(reference.getNumber(), stepIndex);
    }
    catch (const std::invalid_argument &error)
    {
        throw jsi::JSError(runtime, error.what());
    }
}
}
