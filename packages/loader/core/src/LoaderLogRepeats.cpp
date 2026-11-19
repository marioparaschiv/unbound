#include "LoaderLogRepeats.h"

#include <ctime>

namespace loader {
static std::string clockTime(int64_t ms)
{
    std::time_t seconds = static_cast<std::time_t>(ms / 1000);
    std::tm local{};
    localtime_r(&seconds, &local);
    char buffer[16];
    std::strftime(buffer, sizeof(buffer), "%H:%M:%S", &local);
    return buffer;
}

std::string repeatSummary(const std::string &line, int repeats, int64_t firstMs, int64_t lastMs)
{
    return "Repeated " + std::to_string(repeats) + (repeats == 1 ? " more time" : " more times")
           + " between " + clockTime(firstMs) + " and " + clockTime(lastMs) + ": " + line;
}

std::vector<std::string> LogRepeatCollapser::flushLocked(int64_t nowMs, bool everything)
{
    std::vector<std::string> summaries;
    for (auto run = runs.begin(); run != runs.end();)
    {
        if (!everything && nowMs - run->second.last < kLogRepeatQuietMs)
        {
            ++run;
            continue;
        }

        if (run->second.repeats > 0)
        {
            summaries.push_back(repeatSummary(run->first, run->second.repeats, run->second.first,
                                              run->second.last));
        }

        run = runs.erase(run);
    }

    return summaries;
}

std::vector<std::string> LogRepeatCollapser::flush(int64_t nowMs, bool everything)
{
    std::lock_guard<std::mutex> lock(mutex);
    return flushLocked(nowMs, everything);
}

RepeatAdmission LogRepeatCollapser::admit(const std::string &line, int64_t nowMs)
{
    std::lock_guard<std::mutex> lock(mutex);
    RepeatAdmission admission;
    admission.summaries = flushLocked(nowMs, runs.size() >= kLogRepeatKeys);

    auto run = runs.find(line);
    if (run != runs.end())
    {
        run->second.repeats++;
        run->second.last = nowMs;
        admission.write  = false;
        return admission;
    }

    runs[line] = {nowMs, nowMs, 0};
    return admission;
}

LogRepeatCollapser &jsLogRepeats()
{
    static LogRepeatCollapser collapser;
    return collapser;
}
}
