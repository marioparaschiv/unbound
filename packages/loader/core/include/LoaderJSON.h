#pragma once

#include <cstddef>
#include <nlohmann/json.hpp>
#include <string>

namespace loader {
inline constexpr size_t kMaximumJSONDepth = 128;

nlohmann::json parseBoundedJSON(const std::string &text, size_t maximumDepth = kMaximumJSONDepth);
bool jsonNestsTooDeeply(const nlohmann::json &value, size_t maximumDepth = kMaximumJSONDepth);
std::string withValidUTF8(const std::string &text);
}
