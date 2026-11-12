#pragma once

#include <cstddef>
#include <jsi/jsi.h>
#include <nlohmann/json.hpp>
#include <optional>

namespace loader::native {
inline constexpr const char *kNativeBatchResultKey = "$nativeBatchResult";

size_t                batchReferenceIndex(double index, size_t stepIndex);
std::optional<size_t> batchResultIndex(const nlohmann::json &value, size_t stepIndex);
std::optional<size_t> batchResultIndex(facebook::jsi::Runtime     &runtime,
                                       const facebook::jsi::Value &value, size_t stepIndex);
}
