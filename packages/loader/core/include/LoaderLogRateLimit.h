#pragma once

#include <cstdint>
#include <mutex>
#include <optional>
#include <string>
#include <unordered_map>

namespace loader {
constexpr int64_t kLogRateWindowMs = 10'000;
constexpr int kLogRateBudget       = 200;

struct LogAdmission {
    bool write = true;
    std::optional<std::string> summary;
};

class LogRateLimiter
{
public:
    LogAdmission admit(const std::string &scope, int64_t nowMs);

private:
    struct Window {
        int64_t start  = 0;
        int count      = 0;
        int suppressed = 0;
    };

    std::mutex mutex;
    std::unordered_map<std::string, Window> windows;
};

LogRateLimiter &jsLogRateLimiter();
}
