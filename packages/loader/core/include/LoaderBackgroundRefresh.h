#pragma once

#include <cstdint>
#include <mutex>
#include <optional>

namespace loader {
// Where the client keeps the work it runs while Discord is in the background.
inline constexpr const char *kBackgroundRefreshHandler = "__unboundBackgroundRefresh";

// Spaces background refreshes `intervalMs` apart, counting from construction since the
// client checks at launch. A run that has not settled after `limitMs` no longer blocks the next.
class BackgroundRefreshGate
{
public:
    BackgroundRefreshGate(int64_t nowMs, int64_t intervalMs, int64_t limitMs);

    std::optional<uint64_t> begin(int64_t nowMs);
    void finish(uint64_t run);
    bool running(int64_t nowMs) const;

private:
    mutable std::mutex mutex_;
    int64_t intervalMs_;
    int64_t limitMs_;
    int64_t lastStartMs_;
    uint64_t run_   = 0;
    bool unsettled_ = false;
};
}
