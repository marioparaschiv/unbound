#pragma once

#include <chrono>
#include <cstdint>

namespace loader::pipeline_time {
// Wall-clock milliseconds, for records read after a restart.
inline int64_t epochMs()
{
    return std::chrono::duration_cast<std::chrono::milliseconds>(
               std::chrono::system_clock::now().time_since_epoch())
        .count();
}

// Monotonic milliseconds, for intervals within this process.
inline int64_t nowMs()
{
    return std::chrono::duration_cast<std::chrono::milliseconds>(
               std::chrono::steady_clock::now().time_since_epoch())
        .count();
}
}
