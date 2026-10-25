#pragma once

#include <jsi/jsi.h>
#include <nlohmann/json.hpp>
#include <string>

#include "NativeConversionBudget.h"

namespace loader::native {
nlohmann::json serializeBounded(facebook::jsi::Runtime &runtime, const facebook::jsi::Value &value,
                                NativeConversionBudget &budget);
std::string    serializeBounded(facebook::jsi::Runtime &runtime, const facebook::jsi::Value &value,
                                const NativeConversionProfile &profile);
std::string    serializeBoundedObject(facebook::jsi::Runtime        &runtime,
                                      const facebook::jsi::Value    &value,
                                      const NativeConversionProfile &profile);
std::string    serializeBoundedArguments(facebook::jsi::Runtime        &runtime,
                                         const facebook::jsi::Value    &value,
                                         const NativeConversionProfile &profile);
nlohmann::json serializeBoundedBatch(facebook::jsi::Runtime     &runtime,
                                     const facebook::jsi::Value &value, size_t maximumSteps);
std::string    dumpBounded(const nlohmann::json &value, const NativeConversionProfile &profile);
}
