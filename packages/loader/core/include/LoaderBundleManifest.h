#pragma once

#include <cstdint>
#include <map>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace loader {
constexpr const char *kBundleManifestName = "manifest.json";

enum class BundleFlavour
{
    Default,
    Development,
};

struct BundleManifest {
    std::string                        revision;
    std::string                        channel;
    std::string                        buildTime;
    std::optional<int64_t>             buildTimeMilliseconds;
    std::vector<uint32_t>              bytecodeVersions;
    std::map<std::string, std::string> sha512;
    std::string                        nativeBridgeApi;
    std::string                        nativeBridgeAbi;

    bool        isSignable() const;
    std::string bundleFile(uint32_t bytecodeVersion, bool developerMode) const;
    // The DevTools backend's file for this runtime, or nothing when the build ships none.
    std::optional<std::string> devtoolsFile(uint32_t bytecodeVersion) const;
};

std::optional<BundleFlavour> bundleFlavourNamed(std::string_view file);

std::optional<BundleManifest> parseBundleManifest(const std::string &text);
std::optional<int64_t>        parseBuildTime(std::string_view text);

struct BundleBaseline {
    std::string source;
    std::string channel;
    std::string buildTime;
    std::string revision;
    int64_t     buildTimeMilliseconds = 0;
};

std::string                   serializeBaseline(const BundleBaseline &baseline);
std::optional<BundleBaseline> parseBaseline(const std::string &text);
BundleBaseline baselineFromManifest(const BundleManifest &manifest, const std::string &source);
std::optional<std::string> nativeBridgeProblem(const BundleManifest &manifest,
                                               std::string_view      loaderApi,
                                               std::string_view      loaderAbi);
std::optional<std::string> rollbackProblem(const BundleManifest                &manifest,
                                           const std::string                   &source,
                                           const std::optional<BundleBaseline> &baseline);
}
