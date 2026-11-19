#pragma once

#include <string>
#include <vector>

namespace loader::environment_report {
std::vector<std::string> leftoverMods(const std::vector<std::string> &entries);
std::string leftoverModsMarker(const std::string &directory);
}
