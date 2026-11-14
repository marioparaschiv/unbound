#include <cassert>
#include <functional>
#include <string>
#include <vector>

#include "LoaderLogStream.h"

static loader::LogEntry entry(const std::string &message)
{
    return {0, loader::LogSource::JS, loader::LogLevel::Info, {}, message};
}

static void holdsNothingWhileStopped()
{
    loader::LogStream                  stream;
    std::vector<std::function<void()>> scheduled;
    stream.publish(entry("before"));
    assert(!stream.active());
    std::vector<std::string> delivered;
    stream.start(
        [&](std::vector<loader::LogEntry> batch) {
            for (const loader::LogEntry &item : batch)
            {
                delivered.push_back(item.message);
            }
        },
        [&](std::function<void()> work) {
            scheduled.push_back(std::move(work));
        });
    stream.publish(entry("one"));
    stream.publish(entry("two"));
    assert(scheduled.size() == 1);
    scheduled.front()();
    assert((delivered == std::vector<std::string>{"one", "two"}));
    stream.publish(entry("three"));
    assert(scheduled.size() == 2);
    stream.stop();
    scheduled.back()();
    assert(delivered.size() == 2);
}

static void dropsTheOldestPastTheLimit()
{
    loader::LogStream                  stream(2);
    std::vector<std::function<void()>> scheduled;
    std::vector<std::string>           delivered;
    stream.start(
        [&](std::vector<loader::LogEntry> batch) {
            for (const loader::LogEntry &item : batch)
            {
                delivered.push_back(item.message);
            }
        },
        [&](std::function<void()> work) {
            scheduled.push_back(std::move(work));
        });
    stream.publish(entry("a"));
    stream.publish(entry("b"));
    stream.publish(entry("c"));
    scheduled.front()();
    assert((delivered == std::vector<std::string>{"b", "c"}));
}

static void aRestartIgnoresTheEarlierSessionsFlush()
{
    loader::LogStream                  stream;
    std::vector<std::function<void()>> scheduled;
    int                                batches = 0;
    auto                               sink    = [&](std::vector<loader::LogEntry>) {
        batches++;
    };
    auto schedule = [&](std::function<void()> work) {
        scheduled.push_back(std::move(work));
    };
    stream.start(sink, schedule);
    stream.publish(entry("old"));
    stream.start(sink, schedule);
    stream.publish(entry("new"));
    scheduled[0]();
    assert(batches == 0);
    scheduled[1]();
    assert(batches == 1);
}

int main()
{
    holdsNothingWhileStopped();
    dropsTheOldestPastTheLimit();
    aRestartIgnoresTheEarlierSessionsFlush();
    return 0;
}
