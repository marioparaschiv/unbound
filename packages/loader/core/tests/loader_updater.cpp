#include "LoaderFiles.h"
#include "LoaderUpdater.h"

#include <cassert>
#include <filesystem>
#include <string>
#include <unistd.h>

static std::filesystem::path makeTemporaryDirectory()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-updater-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    return std::filesystem::path(directory);
}

int main()
{
    const auto  root      = makeTemporaryDirectory();
    const auto  documents = root.string();
    std::string manifest  = R"({"bytecodeVersions":[96,98]})";
    std::string requestedURL;
    std::map<std::string, std::string> requestedHeaders;
    int         nextStatus = 200;

    loader::SettingsStore settings((root / "settings.json").string());
    settings.load();

    loader::BundleUpdater updater(
        documents, loader::updaterSettings(settings),
        [&](const std::string &url, double) -> std::optional<std::string> {
            if (url.find("manifest.json") == std::string::npos || manifest.empty())
            {
                return std::nullopt;
            }
            return manifest;
        },
        [&](const std::string &url, const std::string &destination,
            const std::map<std::string, std::string> &headers) -> std::optional<loader::DownloadResult> {
            requestedURL     = url;
            requestedHeaders = headers;
            if (nextStatus == 200)
            {
                assert(loader::writeTextFileAtomically(destination, "bundle-" + url));
            }
            return loader::DownloadResult{nextStatus, "\"etag-1\""};
        });

    assert(updater.downloadURL(std::nullopt, 98) == "https://builds.unbound.rip/unbound.98.bundle");
    assert(updater.downloadURL(std::nullopt, 90) == "https://builds.unbound.rip/unbound.js");
    assert(updater.downloadURL(std::string("http://10.0.2.2:3000/unbound.bundle"), 98) ==
           "http://10.0.2.2:3000/unbound.98.bundle");
    manifest.clear();
    assert(updater.downloadURL(std::string("http://10.0.2.2:3000/unbound.bundle"), 98) ==
           "http://10.0.2.2:3000/unbound.bundle");
    manifest = R"({"bytecodeVersions":[98]})";

    std::string initial = updater.resolveBundlePath();
    assert(initial == (root / "unbound.bundle").string());

    std::string candidate = updater.downloadBundle(initial, std::nullopt, 98);
    assert(candidate == (root / "unbound.bundle.candidate").string());
    assert(requestedHeaders.empty());
    assert(updater.resolveBundlePath() == candidate);

    assert(updater.markBundleAttempted(candidate));
    assert(updater.acceptBundle(candidate));
    assert(loader::fileExists((root / "unbound.bundle").string()));
    assert(!loader::fileExists(candidate));
    assert(settings.getString("unbound", "loader.update.etag", "") == "\"etag-1\"");

    nextStatus = 304;
    std::string unchanged = updater.downloadBundle(updater.resolveBundlePath(), std::nullopt, 98);
    assert(unchanged == (root / "unbound.bundle").string());
    assert(requestedHeaders.at("If-None-Match") == "\"etag-1\"");

    nextStatus = 200;
    std::string second = updater.downloadBundle(updater.resolveBundlePath(), std::nullopt, 98);
    assert(updater.markBundleAttempted(second));
    assert(updater.resolveBundlePath() == (root / "unbound.bundle").string());
    assert(!loader::fileExists(second));

    std::filesystem::remove_all(root);
    return 0;
}
