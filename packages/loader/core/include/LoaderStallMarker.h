#pragma once

#include <cstdint>
#include <string>

namespace loader {
bool recordMainThreadStall(const std::string &directory, const std::string &addonRecord,
                           int64_t at);
void clearMainThreadStall(const std::string &directory);
std::string takeStallAddonBefore(const std::string &directory, int64_t exitAt);
}
