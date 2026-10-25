#pragma once

#include <cstddef>
#include <jsi/jsi.h>
#include <nlohmann/json.hpp>
#include <string>

namespace loader::native {
inline constexpr size_t kMaximumHandleIdBytes         = 128;
inline constexpr size_t kMaximumNativeNameBytes       = 256;
inline constexpr size_t kMaximumQueryRoleBytes        = 128;
inline constexpr size_t kMaximumBatchSteps            = 64;
inline constexpr size_t kMaximumAssociationsPerObject = 64;
inline constexpr size_t kMaximumMountedSurfaces       = 64;

std::string parseName(const std::string &value, size_t maximum, const char *subject);
std::string parseName(facebook::jsi::Runtime &runtime, const facebook::jsi::Value &value,
                      size_t maximum, const char *subject);

std::string parseHandleId(const nlohmann::json &handle, const char *subject);
std::string parseHandleId(facebook::jsi::Runtime &runtime, const facebook::jsi::Value &handle,
                          const char *subject);

std::string handleJSON(const std::string &id);
}
