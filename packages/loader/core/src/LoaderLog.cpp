#include "LoaderLog.h"

#include <mutex>

namespace loader
{
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

    void setLogSink(LogSink sink)
    {
        std::lock_guard<std::mutex> lock(sinkMutex());
        currentSink() = std::move(sink);
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
}
