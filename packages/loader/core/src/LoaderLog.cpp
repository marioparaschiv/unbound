#include "LoaderLog.h"

#include <algorithm>
#include <mutex>

namespace loader {
static std::mutex &sinkMutex()
{
    static std::mutex mutex;
    return mutex;
}

static LogSink &currentSink()
{
    static LogSink sink;
    return sink;
}

static SystemLogSink &currentSystemSink()
{
    static SystemLogSink sink;
    return sink;
}

void setLogSink(LogSink sink)
{
    std::lock_guard<std::mutex> lock(sinkMutex());
    currentSink() = std::move(sink);
}

void setSystemLogSink(SystemLogSink sink)
{
    std::lock_guard<std::mutex> lock(sinkMutex());
    currentSystemSink() = std::move(sink);
}

void writeSystemLog(LogLevel level, const std::string &line)
{
    SystemLogSink sink;
    {
        std::lock_guard<std::mutex> lock(sinkMutex());
        sink = currentSystemSink();
    }

    if (sink)
    {
        sink(level, line);
    }
}

void log(LogLevel level, const std::string &category, const std::string &message)
{
    LogSink sink;
    {
        std::lock_guard<std::mutex> lock(sinkMutex());
        sink = currentSink();
    }

    if (sink)
    {
        sink(level, category, message);
    }
}

bool isLogCategory(const std::string &category)
{
    return std::any_of(kLogCategories.begin(), kLogCategories.end(), [&](const char *known) {
        return category == known;
    });
}

LogLevel logLevelFromIndex(int index)
{
    switch (index)
    {
        case static_cast<int>(LogLevel::Debug):
            return LogLevel::Debug;
        case static_cast<int>(LogLevel::Warning):
            return LogLevel::Warning;
        case static_cast<int>(LogLevel::Error):
            return LogLevel::Error;
        default:
            return LogLevel::Info;
    }
}

std::string formatLogLine(const std::string &category, const std::string &message)
{
    return "[" + category + "] " + message;
}

std::string scopedLogLine(const std::vector<std::string> &scope, const std::string &message)
{
    std::string joined;
    for (const std::string &part : scope)
    {
        joined += (joined.empty() ? "" : "/") + part;
    }

    return joined.empty() ? message : formatLogLine(joined, message);
}

void logFromPlatform(int level, const std::string &category, const std::string &message)
{
    if (isLogCategory(category))
    {
        log(logLevelFromIndex(level), category, message);
        return;
    }

    log(logLevelFromIndex(level), LOG_CATEGORY_DEFAULT, formatLogLine(category, message));
}
}
