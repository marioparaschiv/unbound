#pragma once

#include <chrono>
#include <cstdint>
#include <string>

#include "LoaderAddonActivity.h"

namespace loader::native {
inline constexpr int64_t kUIWorkletStallMs = 50;

bool reportsUIWorkletStall(uint64_t stalls);
std::string uiWorkletStallMessage(const std::string &addon, const std::string &hook, int64_t ms,
                                  uint64_t stalls);
uint64_t noteUIWorkletRun(AddonSlot addon, uint32_t hook, int64_t ms);

class UIWorkletTimer
{
public:
    UIWorkletTimer(AddonSlot addon, uint32_t hook);
    ~UIWorkletTimer();

    UIWorkletTimer(const UIWorkletTimer &)            = delete;
    UIWorkletTimer &operator=(const UIWorkletTimer &) = delete;

private:
    AddonSlot addon_;
    uint32_t hook_;
    std::chrono::steady_clock::time_point start_;
};
}
