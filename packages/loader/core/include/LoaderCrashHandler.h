#pragma once

#include <string>

namespace loader {
bool installAddonCrashHandler(const std::string &markerPath);
void noteUncaughtException(const std::string &description);
bool recordUncaughtException(const std::string &description, const std::string &frames);

// The file the crash handler writes the crashing thread's stack to, beside `markerPath`.
constexpr const char *kPendingNativeCrashFile = "native-crash.pending";
// The newest recorded crash's stack, kept until another crash replaces it.
constexpr const char *kNativeCrashFile = "native-crash.txt";
// The stack the previous process wrote as it crashed, read before this one's handler reset it.
std::string previousNativeCrash();
bool adoptPreviousNativeCrash(const std::string &stack);
bool nativeCrashRecorded(const std::string &directory);
}
