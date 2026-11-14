#pragma once

#include <optional>
#include <string>
#include <vector>

namespace loader {
constexpr size_t kBundlePatchNameLength = 32;

std::string bundlePatchPath(const std::string &file, const std::string &baseSha512);

std::optional<std::string> applyBundlePatch(const std::string &base, const std::string &patch);

std::optional<std::string> patchBaseFor(const std::vector<std::string> &bases,
                                        const std::string              &activeSha512);
}
