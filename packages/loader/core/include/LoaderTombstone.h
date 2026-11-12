#pragma once

#include <optional>
#include <string>

namespace loader {
std::optional<std::string> tombstoneStack(const std::string &tombstone);
std::optional<std::string> anrTraceStack(const std::string &trace);
}
