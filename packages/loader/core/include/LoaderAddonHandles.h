#pragma once

#include <cstddef>
#include <string>

#include "LoaderAddonActivity.h"

namespace loader {
inline constexpr size_t kAddonHandleWarning = 10'000;
inline constexpr size_t kAddonHandleLimit   = 50'000;

struct HandleCharge {
    AddonSlot slot = kNoAddon;
    bool admitted  = true;
};

HandleCharge chargeHandle(AddonSlot slot = currentAddon());
void releaseHandle(const HandleCharge &charge);
size_t handlesHeldBy(AddonSlot slot);
std::string handleLimitMessage(AddonSlot slot);
}
