#pragma once

#include <cstddef>
#include <functional>

#include "LoaderAddonActivity.h"

namespace loader::native {
inline constexpr size_t kMainQueueWarning = 500;

std::function<void()> chargeMainWork(std::function<void()> work, AddonSlot addon = currentAddon());
size_t mainWorkPending(AddonSlot addon);
}
