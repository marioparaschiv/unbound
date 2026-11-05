#pragma once

#include <optional>
#include <string>

namespace loader {
// Holds the loader version the newest bundle needs while this loader is too old to run it.
constexpr const char *kRequiredLoaderFile = "unbound.required-loader";

// The loader version the newest published bundle needs, when this loader refused it as too old.
std::optional<std::string> requiredLoaderVersion(const std::string &documents);
// Records the version the newest bundle needs; an empty version clears it once a bundle fits.
void recordRequiredLoader(const std::string &documents, const std::string &version);
}
