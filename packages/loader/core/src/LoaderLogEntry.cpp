#include "LoaderLogEntry.h"

#include <chrono>
#include <cstdio>
#include <ctime>

namespace loader {
long long logNow()
{
    return std::chrono::duration_cast<std::chrono::milliseconds>(
               std::chrono::system_clock::now().time_since_epoch())
        .count();
}

const char *logSourceName(LogSource source)
{
    switch (source)
    {
        case LogSource::JS:
            return "js";
        case LogSource::ReactNative:
            return "react-native";
        case LogSource::Native:
            return "native";
        default:
            return "unbound";
    }
}

std::optional<LogSource> logSourceFromName(const std::string &name)
{
    for (LogSource source :
         {LogSource::Unbound, LogSource::JS, LogSource::ReactNative, LogSource::Native})
    {
        if (name == logSourceName(source))
        {
            return source;
        }
    }
    return std::nullopt;
}

const char *logLevelName(LogLevel level)
{
    switch (level)
    {
        case LogLevel::Debug:
            return "debug";
        case LogLevel::Warning:
            return "warn";
        case LogLevel::Error:
            return "error";
        default:
            return "info";
    }
}

std::optional<LogLevel> logLevelFromName(const std::string &name)
{
    for (LogLevel level : {LogLevel::Debug, LogLevel::Info, LogLevel::Warning, LogLevel::Error})
    {
        if (name == logLevelName(level))
        {
            return level;
        }
    }
    return std::nullopt;
}

nlohmann::json logEntryJSON(const LogEntry &entry)
{
    return {{"t", entry.time},
            {"src", logSourceName(entry.source)},
            {"lvl", logLevelName(entry.level)},
            {"scope", entry.scope},
            {"msg", entry.message}};
}

std::optional<LogEntry> logEntryFromJSON(const nlohmann::json &value)
{
    if (!value.is_object() || !value.contains("t") || !value["t"].is_number() ||
        !value.contains("msg") || !value["msg"].is_string())
    {
        return std::nullopt;
    }
    LogEntry entry;
    entry.time    = value["t"].get<long long>();
    entry.message = value["msg"].get<std::string>();
    if (value.contains("src") && value["src"].is_string())
    {
        entry.source = logSourceFromName(value["src"].get<std::string>()).value_or(entry.source);
    }
    if (value.contains("lvl") && value["lvl"].is_string())
    {
        entry.level = logLevelFromName(value["lvl"].get<std::string>()).value_or(entry.level);
    }
    if (value.contains("scope") && value["scope"].is_array())
    {
        for (const nlohmann::json &part : value["scope"])
        {
            if (part.is_string())
            {
                entry.scope.push_back(part.get<std::string>());
            }
        }
    }
    return entry;
}

std::string logEntryLine(const LogEntry &entry)
{
    // Ordered so a person reading the file sees the time first, as the format documents it.
    nlohmann::ordered_json line{{"t", entry.time},
                                {"src", logSourceName(entry.source)},
                                {"lvl", logLevelName(entry.level)},
                                {"scope", entry.scope},
                                {"msg", entry.message}};
    return line.dump(-1, ' ', false, nlohmann::json::error_handler_t::replace) + "\n";
}

static char levelLetter(LogLevel level)
{
    switch (level)
    {
        case LogLevel::Debug:
            return 'D';
        case LogLevel::Warning:
            return 'W';
        case LogLevel::Error:
            return 'E';
        default:
            return 'I';
    }
}

std::string formatLogEntry(const LogEntry &entry)
{
    std::time_t seconds = static_cast<std::time_t>(entry.time / 1000);
    std::tm     time{};
    gmtime_r(&seconds, &time);
    char stamp[32];
    std::snprintf(stamp, sizeof(stamp), "%04d-%02d-%02dT%02d:%02d:%02d.%03lldZ",
                  time.tm_year + 1900, time.tm_mon + 1, time.tm_mday, time.tm_hour, time.tm_min,
                  time.tm_sec, entry.time % 1000);
    std::string scope;
    for (const std::string &part : entry.scope)
    {
        scope += (scope.empty() ? "" : "/") + part;
    }
    return std::string(stamp) + " " + levelLetter(entry.level) + " " + logSourceName(entry.source) +
           (scope.empty() ? "" : " [" + scope + "]") + " " + entry.message;
}
}
