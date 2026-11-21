#pragma once

#include <cstdint>
#include <optional>
#include <string>

namespace loader {
std::string describeExceptionSyndrome(uint64_t esr);
std::optional<uint64_t> syndromeOfRegisters(const std::string &registersLine);
}
