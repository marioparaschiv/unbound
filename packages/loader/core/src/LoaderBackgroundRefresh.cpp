#include "LoaderBackgroundRefresh.h"

#include <algorithm>

namespace loader {
BackgroundRefreshGate::BackgroundRefreshGate(int64_t nowMs, int64_t intervalMs, int64_t limitMs)
    : intervalMs_(intervalMs), limitMs_(limitMs), lastStartMs_(nowMs)
{
}

int64_t BackgroundRefreshGate::currentIntervalLocked() const
{
    return intervalMs_ << quietRuns_;
}

std::optional<uint64_t> BackgroundRefreshGate::begin(int64_t nowMs)
{
    std::lock_guard lock(mutex_);
    bool stale = nowMs - lastStartMs_ >= limitMs_;
    if ((unsettled_ && !stale) || nowMs - lastStartMs_ < currentIntervalLocked())
    {
        return std::nullopt;
    }

    lastStartMs_ = nowMs;
    unsettled_   = true;
    return ++run_;
}

void BackgroundRefreshGate::finish(uint64_t run, bool changed)
{
    std::lock_guard lock(mutex_);
    if (run != run_)
    {
        return;
    }

    unsettled_ = false;
    quietRuns_ = changed ? 0 : std::min(quietRuns_ + 1, kMaxQuietDoublings);
}

bool BackgroundRefreshGate::running(int64_t nowMs) const
{
    std::lock_guard lock(mutex_);
    return unsettled_ && nowMs - lastStartMs_ < limitMs_;
}

BackgroundRefreshState BackgroundRefreshGate::state(int64_t nowMs) const
{
    std::lock_guard lock(mutex_);
    return {nowMs - lastStartMs_, currentIntervalLocked(), run_,
            unsettled_ && nowMs - lastStartMs_ < limitMs_};
}
}
