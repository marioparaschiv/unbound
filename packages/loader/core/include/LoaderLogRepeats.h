#pragma once

#include <cstdint>
#include <mutex>
#include <string>
#include <unordered_map>
#include <vector>

namespace loader {
constexpr int64_t kLogRepeatQuietMs = 5'000;
constexpr size_t kLogRepeatKeys     = 64;

struct RepeatAdmission {
    bool write = true;
    std::vector<std::string> summaries;
};

class LogRepeatCollapser
{
public:
    RepeatAdmission admit(const std::string &line, int64_t nowMs);
    std::vector<std::string> flush(int64_t nowMs, bool everything = false);

private:
    struct Run {
        int64_t first = 0;
        int64_t last  = 0;
        int repeats   = 0;
    };

    std::mutex mutex;
    std::unordered_map<std::string, Run> runs;

    std::vector<std::string> flushLocked(int64_t nowMs, bool everything);
};

std::string repeatSummary(const std::string &line, int repeats, int64_t firstMs, int64_t lastMs);
LogRepeatCollapser &jsLogRepeats();
}
