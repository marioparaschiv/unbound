#pragma once

#include <cstdint>
#include <string>

namespace loader {
// Moves a fully written addon folder from `staging` to `target`, both relative to Unbound's
// folder: the old copy moves aside, the staged one takes its place, and the old copy is removed.
// Puts the old copy back when the move fails. Returns whether `target` now holds the staged copy.
bool replaceAddonFolder(const std::string &documents, const std::string &staging,
                        const std::string &target);

// Removes leftovers nothing loads: staging folders and addon folders without a manifest, last
// changed more than `minAgeSeconds` ago so an install in progress is left alone. Returns how many
// folders it removed.
size_t removeOrphanedAddonFolders(const std::string &documents, int64_t nowSeconds,
                                  int64_t minAgeSeconds);
}
