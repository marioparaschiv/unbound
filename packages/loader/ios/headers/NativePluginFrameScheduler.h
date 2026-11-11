#pragma once

#include <functional>

namespace loader::ios {
bool scheduleNativePluginFrameWork(std::function<void()> work);
}
