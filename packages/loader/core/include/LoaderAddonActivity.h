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

struct HookCall {
    uint32_t hook;
    uint32_t addon;
};

AddonSlot registerAddonSlot(const std::string &id, const std::string &name);
std::string addonRecord(AddonSlot slot);

AddonSlot currentAddon();
uint32_t *claimActivityCell();
uintptr_t currentActivityThread();
AddonSlot addonOnThread(uintptr_t thread);
void ensureAlternateSignalStack();
void ensureAlternateSignalStacksOnNewThreads();

void noteHookCall(uint32_t hook, AddonSlot addon);
size_t crashingThreadHookCalls(HookCall *out, size_t capacity);
const char *addonRecordText(AddonSlot slot, uint32_t &length);

bool writeCrashingAddonRecord(int descriptor);
bool writeCrashingAddonLine(int descriptor);
size_t crashingAddonMessage(char *out, size_t capacity);

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
