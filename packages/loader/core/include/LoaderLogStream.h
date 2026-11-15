#pragma once

#include <atomic>
#include <cstddef>
#include <cstdint>
#include <deque>
#include <functional>
#include <mutex>
#include <vector>

#include "LoaderLogEntry.h"

namespace loader {
constexpr std::size_t kLogStreamPendingLimit = 2000;
constexpr double kLogStreamBatchSeconds      = 0.1;

using LogBatchSink = std::function<void(std::vector<LogEntry>)>;
// Runs the work later, off the publishing thread.
using LogScheduler = std::function<void(std::function<void()>)>;

// Live log delivery. Holds nothing while stopped; while started it batches published entries and
// hands each batch to the sink once the scheduler runs, dropping the oldest past `limit`.
class LogStream
{
public:
    explicit LogStream(std::size_t limit = kLogStreamPendingLimit);

    void start(LogBatchSink sink, LogScheduler schedule);
    void stop();
    bool active() const;
    void publish(const LogEntry &entry);

private:
    void flush(uint64_t session);

    std::size_t limit_;
    std::atomic_bool active_{false};
    std::mutex mutex_;
    uint64_t session_ = 0;
    bool scheduled_   = false;
    std::deque<LogEntry> pending_;
    LogBatchSink sink_;
    LogScheduler schedule_;
};

// The stream every log file append publishes to.
LogStream &logStream();
}
