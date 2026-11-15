#include "LoaderLogStream.h"

#include <utility>

namespace loader {
LogStream::LogStream(std::size_t limit) : limit_(limit) {}

void LogStream::start(LogBatchSink sink, LogScheduler schedule)
{
    std::lock_guard<std::mutex> lock(mutex_);
    session_++;
    scheduled_ = false;
    pending_.clear();
    sink_     = std::move(sink);
    schedule_ = std::move(schedule);
    active_   = true;
}

void LogStream::stop()
{
    std::lock_guard<std::mutex> lock(mutex_);
    active_ = false;
    session_++;
    scheduled_ = false;
    pending_.clear();
    sink_     = nullptr;
    schedule_ = nullptr;
}

bool LogStream::active() const
{
    return active_;
}

void LogStream::publish(const LogEntry &entry)
{
    // The common case: nothing subscribed, so a log line costs one atomic load here.
    if (!active_)
    {
        return;
    }

    LogScheduler schedule;
    uint64_t session = 0;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        if (!active_)
        {
            return;
        }

        pending_.push_back(entry);
        if (pending_.size() > limit_)
        {
            pending_.pop_front();
        }

        if (scheduled_)
        {
            return;
        }

        scheduled_ = true;
        schedule   = schedule_;
        session    = session_;
    }

    schedule([this, session] {
        flush(session);
    });
}

void LogStream::flush(uint64_t session)
{
    std::vector<LogEntry> batch;
    LogBatchSink sink;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        if (session != session_)
        {
            return;
        }

        scheduled_ = false;
        batch.assign(std::make_move_iterator(pending_.begin()),
                     std::make_move_iterator(pending_.end()));
        pending_.clear();
        sink = sink_;
    }

    if (sink && !batch.empty())
    {
        sink(std::move(batch));
    }
}

LogStream &logStream()
{
    static LogStream stream;
    return stream;
}
}
