#pragma once

#include <string>
#include <vector>

namespace loader {
std::vector<std::string> injectedIOSLibraries(const std::vector<std::string> &imagePaths);
std::vector<std::string> injectedAndroidModules(const std::string &memoryMaps,
                                                const std::string &ownPackage);
}
