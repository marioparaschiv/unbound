#pragma once

#include <nlohmann/json.hpp>
#include <optional>
#include <string>

namespace loader {
std::optional<std::string> metricKitCrashStack(const nlohmann::json &crash);
}
