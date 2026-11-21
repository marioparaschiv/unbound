#include "LoaderBackgroundRefresh.h"

namespace loader {
BackgroundRefreshGate::BackgroundRefreshGate(int64_t nowMs, int64_t intervalMs, int64_t limitMs)
    : intervalMs_(intervalMs), limitMs_(limitMs), lastStartMs_(nowMs)
{
}

std::optional<uint64_t> BackgroundRefreshGate::begin(int64_t nowMs)
{
    std::lock_guard lock(mutex_);
    bool stale = nowMs - lastStartMs_ >= limitMs_;
    if ((unsettled_ && !stale) || nowMs - lastStartMs_ < intervalMs_)
    {
        return std::nullopt;
    }

    lastStartMs_ = nowMs;
    unsettled_   = true;
    return ++run_;
}

void BackgroundRefreshGate::finish(uint64_t run)
{
    std::lock_guard lock(mutex_);
    if (run == run_)
    {
        unsettled_ = false;
    }
}

bool BackgroundRefreshGate::running(int64_t nowMs) const
{
    std::lock_guard lock(mutex_);
    return unsettled_ && nowMs - lastStartMs_ < limitMs_;
}

BackgroundRefreshState BackgroundRefreshGate::state(int64_t nowMs) const
{
    std::lock_guard lock(mutex_);
    return {nowMs - lastStartMs_, intervalMs_, run_, unsettled_ && nowMs - lastStartMs_ < limitMs_};
}
}
