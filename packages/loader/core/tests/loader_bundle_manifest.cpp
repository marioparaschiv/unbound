#include <cassert>
#include <nlohmann/json.hpp>
#include <string>
#include <vector>

#include "LoaderBundleManifest.h"
#include "LoaderBundleSignature.h"

static void parsesBuildTimes()
{
    assert(loader::parseBuildTime("1970-01-01T00:00:00Z") == 0);
    assert(loader::parseBuildTime("1970-01-01T00:00:00.5Z") == 500);
    assert(loader::parseBuildTime("2026-10-27T12:06:15.507Z") == 1793102775507);
    assert(loader::parseBuildTime("2000-02-29T23:59:59Z") == 951868799000);
    assert(!loader::parseBuildTime(""));
    assert(!loader::parseBuildTime("2026-10-27"));
    assert(!loader::parseBuildTime("2026-10-27T12:06:15.507"));
    assert(!loader::parseBuildTime("2026-10-27T12:06:15+02:00"));
    assert(!loader::parseBuildTime("2026-13-27T12:06:15Z"));
    assert(!loader::parseBuildTime("2025-02-29T12:06:15Z"));
    assert(!loader::parseBuildTime("2026-10-27T24:06:15Z"));
    assert(!loader::parseBuildTime("2026-10-27T12:06:15.5070Z"));
    assert(!loader::parseBuildTime("2026-10-27T12:06:15.Z"));
}

static std::string manifestWithHashes(const std::vector<std::string> &files)
{
    nlohmann::json hashes = nlohmann::json::object();
    for (const std::string &file : files)
    {
        hashes[file] = loader::sha512Hex(file);
    }
    return nlohmann::json{{"revision", "r"},
                          {"channel", "beta"},
                          {"buildTime", "2026-10-27T12:06:15Z"},
                          {"bytecodeVersions", {98}},
                          {"sha512", hashes}}
        .dump();
}

static void parsesManifests()
{
    const std::string                     hash     = loader::sha512Hex("bundle");
    std::optional<loader::BundleManifest> manifest = loader::parseBundleManifest(
        R"({"revision":"b53f3860","channel":"beta","buildTime":"2026-10-27T12:06:15.507Z",)"
        R"("bytecodeVersions":[98,96,-1,"94"],"sha512":{"unbound.98.bundle":")" +
        hash + R"(","unbound.js":"not-a-hash"}})");
    assert(manifest);
    assert(manifest->isSignable());
    assert(manifest->revision == "b53f3860" && manifest->channel == "beta");
    assert(manifest->buildTimeMilliseconds == 1793102775507);
    assert((manifest->bytecodeVersions == std::vector<uint32_t>{98, 96}));
    assert(manifest->sha512.size() == 1 && manifest->sha512.at("unbound.98.bundle") == hash);
    assert(manifest->bundleFile(98, false) == "unbound.98.bundle");
    assert(manifest->bundleFile(98, true) == "unbound.98.bundle");
    assert(manifest->bundleFile(90, false) == "unbound.js");
    assert(manifest->bundleFile(90, true) == "unbound.js");

    std::optional<loader::BundleManifest> both = loader::parseBundleManifest(manifestWithHashes(
        {"unbound.98.bundle", "unbound.js", "unbound-dev.98.bundle", "unbound-dev.js"}));
    assert(both);
    assert(both->bundleFile(98, false) == "unbound.98.bundle");
    assert(both->bundleFile(98, true) == "unbound-dev.98.bundle");
    assert(both->bundleFile(90, false) == "unbound.js");
    assert(both->bundleFile(90, true) == "unbound-dev.js");

    std::optional<loader::BundleManifest> sourceOnly = loader::parseBundleManifest(
        manifestWithHashes({"unbound.98.bundle", "unbound.js", "unbound-dev.js"}));
    assert(sourceOnly);
    assert(sourceOnly->bundleFile(98, false) == "unbound.98.bundle");
    assert(sourceOnly->bundleFile(98, true) == "unbound-dev.js");

    assert(loader::bundleFlavourNamed("unbound.js") == loader::BundleFlavour::Default);
    assert(loader::bundleFlavourNamed("unbound.98.bundle") == loader::BundleFlavour::Default);
    assert(loader::bundleFlavourNamed("unbound-dev.js") == loader::BundleFlavour::Development);
    assert(loader::bundleFlavourNamed("https://builds.unbound.rip/unbound-dev.98.bundle") ==
           loader::BundleFlavour::Development);
    assert(!loader::bundleFlavourNamed("manifest.json"));

    std::optional<loader::BundleManifest> legacy = loader::parseBundleManifest(
        R"({"revision":"b53f3860","buildTime":"2026-10-27T12:06:15.507Z","bytecodeVersions":[98]})");
    assert(legacy && !legacy->isSignable());
    assert(!loader::parseBundleManifest("[]"));
    assert(!loader::parseBundleManifest("{"));
}

static loader::BundleManifest manifestAt(const std::string &buildTime,
                                         const std::string &channel = "beta")
{
    loader::BundleManifest manifest;
    manifest.revision              = "r";
    manifest.channel               = channel;
    manifest.buildTime             = buildTime;
    manifest.buildTimeMilliseconds = loader::parseBuildTime(buildTime);
    return manifest;
}

static void enforcesTheBaseline()
{
    const std::string      source = "https://builds.unbound.rip/";
    loader::BundleBaseline baseline =
        loader::baselineFromManifest(manifestAt("2026-10-27T12:00:00Z"), source);
    std::optional<loader::BundleBaseline> stored =
        loader::parseBaseline(loader::serializeBaseline(baseline));
    assert(stored && stored->source == source && stored->channel == "beta");
    assert(stored->buildTimeMilliseconds == baseline.buildTimeMilliseconds);

    assert(!loader::rollbackProblem(manifestAt("2026-10-27T12:00:00Z"), source, stored));
    assert(!loader::rollbackProblem(manifestAt("2026-10-28T00:00:00Z"), source, stored));
    assert(loader::rollbackProblem(manifestAt("2026-10-27T11:59:59.999Z"), source, stored));
    assert(loader::rollbackProblem(manifestAt("2026-10-28T00:00:00Z", "stable"), source, stored));
    assert(!loader::rollbackProblem(manifestAt("2020-01-01T00:00:00Z"), "https://other.example/",
                                    stored));
    assert(!loader::rollbackProblem(manifestAt("2020-01-01T00:00:00Z"), source, std::nullopt));

    assert(!loader::parseBaseline(""));
    assert(!loader::parseBaseline("{}"));
    assert(!loader::parseBaseline(R"({"source":"x","buildTime":"yesterday"})"));
}

static loader::BundleManifest bridgeManifest(const std::string &api, const std::string &abi)
{
    return *loader::parseBundleManifest(R"({"nativeBridge":{"api":")" + api + R"(","abi":")" + abi +
                                        R"("}})");
}

static void checksTheNativeBridge()
{
    loader::BundleManifest parsed = bridgeManifest("1.2.0", "1.0.0");
    assert(parsed.nativeBridgeApi == "1.2.0" && parsed.nativeBridgeAbi == "1.0.0");

    assert(!loader::nativeBridgeProblem(*loader::parseBundleManifest("{}"), "1.0.0", "1.0.0"));
    assert(!loader::nativeBridgeProblem(bridgeManifest("1.0.0", "1.0.0"), "1.0.0", "1.0.0"));
    assert(!loader::nativeBridgeProblem(bridgeManifest("1.0.0", "1.0.0"), "1.3.0", "1.2.0"));
    assert(!loader::nativeBridgeProblem(bridgeManifest("1.2.9", "1.0.0"), "1.3.0", "1.0.0"));
    assert(loader::nativeBridgeProblem(bridgeManifest("1.4.0", "1.0.0"), "1.3.0", "1.0.0"));
    assert(loader::nativeBridgeProblem(bridgeManifest("1.0.1", "1.0.0"), "1.0.0", "1.0.0"));
    assert(loader::nativeBridgeProblem(bridgeManifest("2.0.0", "1.0.0"), "1.9.0", "1.0.0"));
    assert(loader::nativeBridgeProblem(bridgeManifest("1.0.0", "1.0.0"), "2.0.0", "1.0.0"));
    assert(loader::nativeBridgeProblem(bridgeManifest("1.0.0", "2.0.0"), "1.0.0", "1.0.0"));
    assert(loader::nativeBridgeProblem(bridgeManifest("1.0", "1.0.0"), "1.0.0", "1.0.0"));
    assert(loader::nativeBridgeProblem(bridgeManifest("1.0.0-beta", "1.0.0"), "1.0.0", "1.0.0"));
    assert(loader::nativeBridgeProblem(bridgeManifest("", "1.0.0"), "1.0.0", "1.0.0"));
}

static loader::BundleManifest loaderManifest(const std::string &version)
{
    return *loader::parseBundleManifest(R"({"minLoaderVersion":")" + version + R"("})");
}

static void checksTheLoaderVersion()
{
    assert(loaderManifest("1.2.0").minLoaderVersion == "1.2.0");

    assert(!loader::loaderVersionProblem(*loader::parseBundleManifest("{}"), "1.0.0"));
    assert(!loader::loaderVersionProblem(loaderManifest("1.2.0"), "1.2.0"));
    assert(!loader::loaderVersionProblem(loaderManifest("1.2.0"), "2.0.0"));
    assert(!loader::loaderVersionProblem(loaderManifest("1.2.0"), "dev"));
    assert(loader::loaderVersionProblem(loaderManifest("1.2.0"), "1.1.9"));
    assert(loader::loaderVersionProblem(loaderManifest("1.2"), "1.0.0"));
}

int main()
{
    parsesBuildTimes();
    parsesManifests();
    enforcesTheBaseline();
    checksTheNativeBridge();
    checksTheLoaderVersion();
    return 0;
}
