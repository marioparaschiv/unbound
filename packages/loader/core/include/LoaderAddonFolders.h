#pragma once

#include <cstdint>
#include <string>

namespace loader {
bool replaceAddonFolder(const std::string &documents, const std::string &staging,
                        const std::string &target);

size_t removeOrphanedAddonFolders(const std::string &documents, int64_t nowSeconds,
                                  int64_t minAgeSeconds);
}
