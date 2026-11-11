#pragma once

#include <string>

namespace loader {
bool installAddonCrashHandler(const std::string &markerPath);

// The file the crash handler writes the crashing thread's stack to, beside `markerPath`.
constexpr const char *kNativeCrashFile = "native-crash.txt";
// The stack the previous process wrote as it crashed, read before this one's handler reset it.
std::string previousNativeCrash();
}
