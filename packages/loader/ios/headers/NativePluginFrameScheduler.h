#pragma once

#include <functional>

namespace loader::ios {
void scheduleNativePluginFrameWork(std::function<void()> work);
}
