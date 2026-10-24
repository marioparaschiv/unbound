#pragma once

#include <functional>
#include <string>

namespace loader
{
    enum class LogLevel
    {
        Debug,
        Info,
        Warning,
        Error,
    };

    using LogSink = std::function<void(LogLevel, const std::string &, const std::string &)>;

    void setLogSink(LogSink sink);
    void log(LogLevel level, const std::string &category, const std::string &message);
}
