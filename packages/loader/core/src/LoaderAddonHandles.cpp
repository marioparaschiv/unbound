#include "LoaderAddonHandles.h"

#include <array>
#include <atomic>
#include <nlohmann/json.hpp>

#include "LoaderLog.h"

namespace loader {
static std::array<std::atomic<size_t>, kAddonSlotCapacity> gHeld{};
static std::array<std::atomic<bool>, kAddonSlotCapacity> gWarned{};

static std::string addonName(AddonSlot slot)
{
    nlohmann::json record = nlohmann::json::parse(addonRecord(slot), nullptr, false);
    if (record.is_object() && record["name"].is_string())
    {
        return record["name"].get<std::string>();
    }

    return "A plugin";
}

static bool tracked(AddonSlot slot)
{
    return slot != kNoAddon && slot < kAddonSlotCapacity;
}

HandleCharge chargeHandle(AddonSlot slot)
{
    if (!tracked(slot))
    {
        return {};
    }

    if (gHeld[slot].load(std::memory_order_relaxed) >= kAddonHandleLimit)
    {
        return {kNoAddon, false};
    }

    size_t held = gHeld[slot].fetch_add(1, std::memory_order_relaxed) + 1;
    if (held >= kAddonHandleWarning && !gWarned[slot].exchange(true))
    {
        log(LogLevel::Warning, LOG_CATEGORY_PLUGINS,
            addonName(slot) + " holds " + std::to_string(held)
                + " native handles at once; it may be leaking them.");
    }

    return {slot, true};
}

void releaseHandle(const HandleCharge &charge)
{
    if (tracked(charge.slot))
    {
        gHeld[charge.slot].fetch_sub(1, std::memory_order_relaxed);
    }
}

size_t handlesHeldBy(AddonSlot slot)
{
    return tracked(slot) ? gHeld[slot].load(std::memory_order_relaxed) : 0;
}

std::string handleLimitMessage(AddonSlot slot)
{
    return addonName(slot) + " holds " + std::to_string(kAddonHandleLimit)
           + " native handles, the most a plugin may hold at once. Let unused handles go first.";
}
}
