#include "NativeMainQueue.h"

#include <array>
#include <atomic>
#include <memory>
#include <nlohmann/json.hpp>

#include "LoaderLog.h"

namespace loader::native {
namespace {
    std::array<std::atomic<size_t>, kAddonSlotCapacity> gPending{};
    std::array<std::atomic<bool>, kAddonSlotCapacity> gWarned{};

    bool tracked(AddonSlot addon)
    {
        return addon != kNoAddon && addon < kAddonSlotCapacity;
    }

    std::string addonName(AddonSlot addon)
    {
        nlohmann::json record = nlohmann::json::parse(addonRecord(addon), nullptr, false);
        return record.is_object() && record["name"].is_string() ? record["name"].get<std::string>()
                                                                : "A plugin";
    }

    struct PendingWork {
        explicit PendingWork(AddonSlot slot) : addon(slot) {}

        PendingWork(const PendingWork &)            = delete;
        PendingWork &operator=(const PendingWork &) = delete;

        AddonSlot addon;

        ~PendingWork()
        {
            gPending[addon].fetch_sub(1, std::memory_order_relaxed);
        }
    };
}

std::function<void()> chargeMainWork(std::function<void()> work, AddonSlot addon)
{
    if (!tracked(addon))
    {
        return work;
    }

    size_t pending = gPending[addon].fetch_add(1, std::memory_order_relaxed) + 1;
    if (pending >= kMainQueueWarning && !gWarned[addon].exchange(true))
    {
        log(LogLevel::Warning, LOG_CATEGORY_PLUGINS,
            addonName(addon) + " has " + std::to_string(pending)
                + " native calls waiting for the main thread; Discord will stutter until they run.");
    }

    auto guard = std::make_shared<PendingWork>(addon);
    return [work = std::move(work), guard]() {
        work();
    };
}

size_t mainWorkPending(AddonSlot addon)
{
    return tracked(addon) ? gPending[addon].load(std::memory_order_relaxed) : 0;
}
}
