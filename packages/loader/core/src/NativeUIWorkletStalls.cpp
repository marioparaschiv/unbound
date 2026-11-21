#include "NativeUIWorkletStalls.h"

#include <map>
#include <mutex>
#include <utility>

#include "LoaderHookBreadcrumbs.h"
#include "LoaderLog.h"
#include "NativeHookConflicts.h"

namespace loader::native {
namespace {
    std::mutex &stallsMutex()
    {
        static auto *mutex = new std::mutex();
        return *mutex;
    }

    std::map<std::pair<AddonSlot, uint32_t>, uint64_t> &stallCounts()
    {
        static auto *counts = new std::map<std::pair<AddonSlot, uint32_t>, uint64_t>();
        return *counts;
    }
}

bool reportsUIWorkletStall(uint64_t stalls)
{
    if (stalls == 0)
    {
        return false;
    }

    while (stalls % 10 == 0)
    {
        stalls /= 10;
    }

    return stalls == 1;
}

std::string uiWorkletStallMessage(const std::string &addon, const std::string &hook, int64_t ms,
                                  uint64_t stalls)
{
    std::string message = addon + "'s UI worklet on " + (hook.empty() ? "a hook" : hook)
                          + " blocked the UI thread for " + std::to_string(ms) + " ms";
    if (stalls > 1)
    {
        message += " (" + std::to_string(stalls) + " stalls so far)";
    }

    return message + ".";
}

uint64_t noteUIWorkletRun(AddonSlot addon, uint32_t hook, int64_t ms)
{
    if (ms < kUIWorkletStallMs)
    {
        return 0;
    }

    uint64_t stalls = 0;
    {
        std::lock_guard<std::mutex> lock(stallsMutex());
        stalls = ++stallCounts()[{addon, hook}];
    }

    if (reportsUIWorkletStall(stalls))
    {
        log(LogLevel::Warning, LOG_CATEGORY_HOOKS,
            uiWorkletStallMessage(addonDisplayName(addon), hookName(hook), ms, stalls));
    }

    return stalls;
}

UIWorkletTimer::UIWorkletTimer(AddonSlot addon, uint32_t hook)
    : addon_(addon), hook_(hook), start_(std::chrono::steady_clock::now())
{
}

UIWorkletTimer::~UIWorkletTimer()
{
    auto elapsed = std::chrono::steady_clock::now() - start_;
    noteUIWorkletRun(addon_, hook_,
                     std::chrono::duration_cast<std::chrono::milliseconds>(elapsed).count());
}
}
