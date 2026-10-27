#include <cassert>
#include <string>

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
    assert(manifest->bundleFile(98) == "unbound.98.bundle");
    assert(manifest->bundleFile(90) == "unbound.js");

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

int main()
{
    parsesBuildTimes();
    parsesManifests();
    enforcesTheBaseline();
    return 0;
}
