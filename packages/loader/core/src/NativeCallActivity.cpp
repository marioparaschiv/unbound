#include "NativeCallActivity.h"

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstring>
#include <unistd.h>

#include "LoaderAddonActivity.h"

namespace loader {
struct NativeCallSlot {
    std::atomic<uintptr_t> owner{0};
    std::atomic<uint32_t> sequence{0};
    std::atomic<int64_t> startedAt{0};
    char label[kNativeCallLabelLimit] = {};
};

static NativeCallSlot gSlots[kActivityThreadLimit];

struct BridgeTrail {
    char labels[kBridgeTrailLength][kNativeCallLabelLimit] = {};
    std::atomic<uint32_t> next{0};
    std::atomic<int64_t> lastAt{0};
};

static BridgeTrail gTrails[kAddonSlotCapacity];

static void noteBridgeCall(AddonSlot addon, const std::string &label, int64_t at)
{
    if (addon == kNoAddon || addon >= kAddonSlotCapacity)
    {
        return;
    }

    BridgeTrail &trail = gTrails[addon];
    uint32_t index     = trail.next.fetch_add(1, std::memory_order_relaxed) % kBridgeTrailLength;
    std::strncpy(trail.labels[index], label.c_str(), kNativeCallLabelLimit - 1);
    trail.labels[index][kNativeCallLabelLimit - 1] = '\0';
    trail.lastAt.store(at, std::memory_order_release);
}

static void writeTrail(int descriptor, AddonSlot addon, const BridgeTrail &trail)
{
    uint32_t recordLength  = 0;
    const char *record     = addonRecordText(addon, recordLength);
    const char prefix[]    = "Bridge calls ";
    const char separator[] = " | ";
    const char space       = ' ';
    const char newline     = '\n';
    ssize_t written        = write(descriptor, prefix, sizeof(prefix) - 1);
    if (record)
    {
        written = write(descriptor, record, recordLength);
        written = write(descriptor, &space, 1);
    }

    uint32_t next  = trail.next.load(std::memory_order_relaxed);
    uint32_t count = std::min<uint32_t>(next, kBridgeTrailLength);
    for (uint32_t offset = count; offset > 0; offset--)
    {
        const char *label = trail.labels[(next - offset) % kBridgeTrailLength];
        size_t length     = strnlen(label, kNativeCallLabelLimit);
        written           = write(descriptor, label, length);
        if (offset > 1)
        {
            written = write(descriptor, separator, sizeof(separator) - 1);
        }
    }

    written = write(descriptor, &newline, 1);
    (void) written;
}

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

CurrentNativeCall currentNativeCall()
{
    NativeCallSlot *slot = tClaim.slot;
    if (!slot || slot->startedAt.load(std::memory_order_relaxed) == 0)
    {
        return {};
    }

    return {std::string_view(slot->label), slot->sequence.load(std::memory_order_relaxed)};
}

bool writeCrashingNativeCallLine(int descriptor)
{
    uintptr_t thread = currentActivityThread();
    if (descriptor < 0 || thread == 0)
    {
        return false;
    }

    for (const NativeCallSlot &slot : gSlots)
    {
        if (slot.owner.load(std::memory_order_acquire) != thread)
        {
            continue;
        }

        size_t length = strnlen(slot.label, kNativeCallLabelLimit);
        if (slot.startedAt.load(std::memory_order_relaxed) == 0 || length == 0)
        {
            return false;
        }

        const char prefix[] = "Native call ";
        const char newline  = '\n';
        return write(descriptor, prefix, sizeof(prefix) - 1) > 0
               && write(descriptor, slot.label, length) > 0 && write(descriptor, &newline, 1) > 0;
    }

    return false;
}

bool writeRecentBridgeCallLines(int descriptor, int64_t now)
{
    if (descriptor < 0)
    {
        return false;
    }

    bool wrote = false;
    for (AddonSlot addon = 1; addon < kAddonSlotCapacity; addon++)
    {
        int64_t lastAt = gTrails[addon].lastAt.load(std::memory_order_acquire);
        if (lastAt == 0 || now - lastAt > kBridgeTrailWindowMs)
        {
            continue;
        }

        writeTrail(descriptor, addon, gTrails[addon]);
        wrote = true;
    }

    return wrote;
}

std::string describeNativeCall(const std::optional<NativeCallSnapshot> &call, int64_t now)
{
    if (!call)
    {
        return "It is running JavaScript, outside any native call.";
    }

    int64_t elapsed = std::max<int64_t>(0, now - call->startedAt);
    return "It has been inside the native call " + call->label + " for " + std::to_string(elapsed)
           + " ms.";
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
    int64_t now       = nativeCallClock();
    noteBridgeCall(currentAddon(), label, now);
    publish(*slot_, label.c_str(), now);
}

NativeCallScope::~NativeCallScope()
{
    if (slot_)
    {
        publish(*slot_, previousLabel_, previousStartedAt_);
    }
}
}
