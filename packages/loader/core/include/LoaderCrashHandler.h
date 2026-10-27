#pragma once

#include <string>

namespace loader {
bool installAddonCrashHandler(const std::string &markerPath);
bool addonCrashHandlerInstalled();
}
