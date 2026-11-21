#pragma once

#include <cstdint>
#include <mutex>
#include <optional>

namespace loader {
inline constexpr const char *kBackgroundRefreshHandler = "__unboundBackgroundRefresh";

struct BackgroundRefreshState {
    int64_t sinceLastMs;
    int64_t intervalMs;
    uint64_t runs;
    bool running;
};

class BackgroundRefreshGate
{
public:
    static constexpr int kMaxQuietDoublings = 3;

    BackgroundRefreshGate(int64_t nowMs, int64_t intervalMs, int64_t limitMs);

    std::optional<uint64_t> begin(int64_t nowMs);
    void finish(uint64_t run, bool changed);
    bool running(int64_t nowMs) const;
    BackgroundRefreshState state(int64_t nowMs) const;

private:
    int64_t currentIntervalLocked() const;

    mutable std::mutex mutex_;
    int64_t intervalMs_;
    int64_t limitMs_;
    int64_t lastStartMs_;
    uint64_t run_   = 0;
    bool unsettled_ = false;
    int quietRuns_  = 0;
};
}
