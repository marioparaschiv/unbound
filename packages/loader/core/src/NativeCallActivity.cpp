#include "NativeCallActivity.h"

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstring>

#include "LoaderAddonActivity.h"

namespace loader {
struct NativeCallSlot {
    std::atomic<uintptr_t> owner{0};
    std::atomic<uint32_t>  sequence{0};
    std::atomic<int64_t>   startedAt{0};
    char                   label[kNativeCallLabelLimit] = {};
};

static NativeCallSlot gSlots[kActivityThreadLimit];

struct SlotClaim {
    NativeCallSlot *slot = nullptr;

    ~SlotClaim()
    {
        if (slot)
        {
            slot->owner.store(0, std::memory_order_release);
        }
    }
};

static thread_local SlotClaim tClaim;

static NativeCallSlot *claimSlot()
{
    if (tClaim.slot)
    {
        return tClaim.slot;
    }

    uintptr_t key = currentActivityThread();
    for (NativeCallSlot &slot : gSlots)
    {
        uintptr_t expected = 0;
        if (slot.owner.compare_exchange_strong(expected, key, std::memory_order_acq_rel))
        {
            slot.startedAt.store(0, std::memory_order_relaxed);
            slot.label[0] = '\0';
            tClaim.slot   = &slot;
            return &slot;
        }
    }
    return nullptr;
}

static void publish(NativeCallSlot &slot, const char *label, int64_t startedAt)
{
    slot.sequence.fetch_add(1, std::memory_order_acq_rel);
    std::strncpy(slot.label, label, kNativeCallLabelLimit - 1);
    slot.label[kNativeCallLabelLimit - 1] = '\0';
    slot.startedAt.store(startedAt, std::memory_order_relaxed);
    slot.sequence.fetch_add(1, std::memory_order_release);
}

int64_t nativeCallClock()
{
    return std::chrono::duration_cast<std::chrono::milliseconds>(
               std::chrono::steady_clock::now().time_since_epoch())
        .count();
}

std::optional<NativeCallSnapshot> nativeCallOnThread(uintptr_t thread)
{
    if (thread == 0)
    {
        return std::nullopt;
    }

    for (const NativeCallSlot &slot : gSlots)
    {
        if (slot.owner.load(std::memory_order_acquire) != thread)
        {
            continue;
        }

        for (int attempt = 0; attempt < 8; attempt++)
        {
            uint32_t before = slot.sequence.load(std::memory_order_acquire);
            if (before % 2 != 0)
            {
                continue;
            }
            char label[kNativeCallLabelLimit];
            std::memcpy(label, slot.label, kNativeCallLabelLimit);
            int64_t startedAt = slot.startedAt.load(std::memory_order_relaxed);
            if (slot.sequence.load(std::memory_order_acquire) != before)
            {
                continue;
            }
            label[kNativeCallLabelLimit - 1] = '\0';
            if (startedAt == 0 || label[0] == '\0')
            {
                return std::nullopt;
            }
            return NativeCallSnapshot{label, startedAt};
        }
        return std::nullopt;
    }
    return std::nullopt;
}

std::string describeNativeCall(const std::optional<NativeCallSnapshot> &call, int64_t now)
{
    if (!call)
    {
        return "It is running JavaScript, outside any native call.";
    }
    int64_t elapsed = std::max<int64_t>(0, now - call->startedAt);
    return "It has been inside the native call " + call->label + " for " + std::to_string(elapsed) +
           " ms.";
}

NativeCallScope::NativeCallScope(const std::string &name, const std::string &detail)
    : slot_(claimSlot())
{
    if (!slot_)
    {
        return;
    }
    std::memcpy(previousLabel_, slot_->label, kNativeCallLabelLimit);
    previousStartedAt_ = slot_->startedAt.load(std::memory_order_relaxed);

    std::string label = detail.empty() ? name : name + "(" + detail + ")";
    publish(*slot_, label.c_str(), nativeCallClock());
}

NativeCallScope::~NativeCallScope()
{
    if (slot_)
    {
        publish(*slot_, previousLabel_, previousStartedAt_);
    }
}
}
