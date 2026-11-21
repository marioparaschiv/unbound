#pragma once

#include <cstddef>
#include <cstdint>
#include <string>

namespace loader {
using AddonSlot = uint32_t;

inline constexpr AddonSlot kNoAddon           = 0;
inline constexpr size_t kAddonSlotCapacity    = 256;
inline constexpr size_t kActivityThreadLimit  = 128;
inline constexpr size_t kAddonRecordByteLimit = 512;
inline constexpr size_t kHookTrailLength      = 16;

inline constexpr uint32_t kNoHookCall = UINT32_MAX;

struct HookCall {
    uint32_t hook;
    uint32_t addon;
    uint32_t returned;
};

AddonSlot registerAddonSlot(const std::string &id, const std::string &name);
std::string addonRecord(AddonSlot slot);

AddonSlot currentAddon();
uint32_t *claimActivityCell();
uintptr_t currentActivityThread();
AddonSlot addonOnThread(uintptr_t thread);
void ensureAlternateSignalStack();
void ensureAlternateSignalStacksOnNewThreads();

uint32_t noteHookCall(uint32_t hook, AddonSlot addon);
void noteHookReturn(uint32_t call);
size_t crashingThreadHookCalls(HookCall *out, size_t capacity, bool runningOnly = false);
const char *addonRecordText(AddonSlot slot, uint32_t &length);

bool writeCrashingAddonRecord(int descriptor);
bool writeCrashingAddonLine(int descriptor);
size_t crashingAddonMessage(char *out, size_t capacity);

class HookTrailMark
{
public:
    HookTrailMark() = default;
    ~HookTrailMark();

    HookTrailMark(const HookTrailMark &)            = delete;
    HookTrailMark &operator=(const HookTrailMark &) = delete;

    void note(uint32_t hook, AddonSlot addon);

private:
    uint32_t first_ = kNoHookCall;
    uint32_t count_ = 0;
};

class AddonScope
{
public:
    explicit AddonScope(AddonSlot slot);
    ~AddonScope();

    AddonScope(const AddonScope &)            = delete;
    AddonScope &operator=(const AddonScope &) = delete;

private:
    uint32_t *cell_     = nullptr;
    AddonSlot previous_ = kNoAddon;
};
}
