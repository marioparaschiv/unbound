#pragma once

#include <cstddef>
#include <cstdint>
#include <string>

namespace loader {
using AddonSlot = uint32_t;

inline constexpr AddonSlot kNoAddon              = 0;
inline constexpr size_t    kAddonSlotCapacity    = 256;
inline constexpr size_t    kActivityThreadLimit  = 128;
inline constexpr size_t    kAddonRecordByteLimit = 512;

AddonSlot   registerAddonSlot(const std::string &id, const std::string &name);
std::string addonRecord(AddonSlot slot);

AddonSlot currentAddon();
uint32_t *claimActivityCell();

bool writeCrashingAddonRecord(int descriptor);

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
