#pragma once

#include <nlohmann/json.hpp>
#include <optional>
#include <string>

namespace loader {
std::optional<std::string> metricKitCrashStack(const nlohmann::json &crash);
std::optional<std::string> metricKitHangStack(const nlohmann::json &hang);
std::optional<std::string> metricKitDiskWriteStack(const nlohmann::json &diskWrite);
}
