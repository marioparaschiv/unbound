#pragma once

#include <cstddef>
#include <cstdint>
#include <string>

namespace loader {
inline constexpr size_t kHookNameCapacity = 1024;
inline constexpr size_t kHookNameBytes    = 96;

uint32_t registerHookName(const std::string &name);
std::string hookName(uint32_t hook);
bool writeCrashingHookLines(int descriptor);
}
