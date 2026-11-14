#pragma once

#include <optional>
#include <string>
#include <string_view>

#include "LoaderLogEntry.h"

namespace loader {
// The tag the loader writes its own logcat lines under; the logcat reader skips it.
constexpr const char *kLoaderLogcatTag = "Unbound";

// The source a logcat tag belongs to, or nothing for tags already captured elsewhere: the
// loader's own `Unbound` and React Native's console tag `ReactNativeJS`.
std::optional<LogSource> logcatTagSource(std::string_view tag);
// Parses one `logcat -v epoch` line (`<sec>.<ms> <pid> <tid> <L> <tag>: <msg>`) into a
// `react-native` or `native` entry scoped to its tag; nothing for banners and skipped tags.
std::optional<LogEntry> logcatEntry(std::string_view line);
// `<sec>.<ms>`, the time format `logcat -T` accepts alongside `-v epoch`.
std::string logcatTime(long long time);
}
