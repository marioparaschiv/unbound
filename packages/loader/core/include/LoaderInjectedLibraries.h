#pragma once

#include <map>
#include <string>
#include <utility>
#include <vector>

namespace loader {
std::vector<std::string> injectedIOSLibraries(const std::vector<std::string> &imagePaths);
std::map<std::string, std::string>
injectedLibraryPackages(const std::vector<std::pair<std::string, std::string>> &packageLists,
                        const std::vector<std::string> &libraries);
std::vector<std::string> injectedAndroidModules(const std::string &memoryMaps,
                                                const std::string &ownPackage);
}
