#pragma once

#include <nlohmann/json.hpp>
#include <optional>
#include <string>
#include <vector>

#include "LoaderLog.h"

namespace loader {
// Where a log line came from. Unbound and JS lines go to `unbound.log`, the rest to `native.log`.
enum class LogSource
{
    Unbound,
    JS,
    ReactNative,
    Native,
};

// One log line, as written to disk and delivered to `UnboundNative.logs` subscribers.
struct LogEntry {
    long long                time   = 0;
    LogSource                source = LogSource::Unbound;
    LogLevel                 level  = LogLevel::Info;
    std::vector<std::string> scope;
    std::string              message;
};

long long                logNow();
const char              *logSourceName(LogSource source);
std::optional<LogSource> logSourceFromName(const std::string &name);
const char              *logLevelName(LogLevel level);
std::optional<LogLevel>  logLevelFromName(const std::string &name);

// `{"t":<epoch ms>,"src":"...","lvl":"...","scope":[...],"msg":"..."}`.
nlohmann::json          logEntryJSON(const LogEntry &entry);
std::optional<LogEntry> logEntryFromJSON(const nlohmann::json &value);
// The entry as one JSON line ending in a newline; invalid UTF-8 is replaced, never thrown on.
std::string logEntryLine(const LogEntry &entry);
// `<ISO time> <L> <source> [scope/...] message`, for crash reports and other readers of plain text.
std::string formatLogEntry(const LogEntry &entry);
}
