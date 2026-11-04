#include <cassert>
#include <filesystem>
#include <string>
#include <unistd.h>

#include "LoaderFiles.h"
#include "LoaderUpdater.h"

static std::filesystem::path makeTemporaryDirectory()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-devtools-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    return std::filesystem::path(directory);
}

static std::string manifestListing(const std::string &file, const std::string &contents)
{
    return R"({"bytecodeVersions":[98],"sha512":{"unbound.98.bundle":")" +
           loader::sha512Hex("bundle") + R"(",")" + file + R"(":")" + loader::sha512Hex(contents) +
           R"("}})";
}

int main()
{
    const auto  root      = makeTemporaryDirectory();
    const auto  documents = root.string();
    std::string manifest  = R"({"bytecodeVersions":[98],"sha512":{}})";
    std::string served    = "backend";
    int         downloads = 0;
    std::string requestedURL;

    loader::SettingsStore settings((root / "settings.json").string());
    settings.load();

    loader::BundleUpdater updater(
        documents, loader::updaterSettings(settings),
        [&](const std::string &url, double) -> std::optional<std::string> {
            return url.find("manifest.json") == std::string::npos ? std::nullopt
                                                                  : std::optional(manifest);
        },
        [&](const std::string &url, const std::string &destination,
            const std::map<std::string, std::string> &,
            const loader::DownloadPolicy &) -> std::optional<loader::DownloadResult> {
            requestedURL = url;
            downloads++;
            assert(loader::writeTextFileAtomically(
                destination, url.find("/unbound.") != std::string::npos ? "bundle" : served));
            return loader::DownloadResult{200, "\"etag\""};
        },
        loader::BundleTrust{});

    // An unkeyed loader records its bundle as exempt, so the backend's hash comes from the live
    // manifest.
    std::string bundle = updater.downloadBundle(updater.resolveBundlePath(), std::nullopt, 98);
    const std::string cached = (root / "devtools.98.bundle").string();

    // A build without the backend loads none.
    assert(!updater.devtoolsScript(bundle, 98));

    manifest                          = manifestListing("devtools.98.bundle", "backend");
    downloads                         = 0;
    std::optional<std::string> script = updater.devtoolsScript(bundle, 98);
    assert(script && *script == "backend");
    assert(requestedURL == "https://builds.unbound.rip/devtools.98.bundle");
    assert(downloads == 1);
    assert(loader::readTextFile(cached) == std::optional<std::string>("backend"));

    // A cached copy matching the manifest runs without a download.
    assert(updater.devtoolsScript(bundle, 98) == std::optional<std::string>("backend"));
    assert(downloads == 1);

    // A download whose hash differs from the manifest is refused and not cached.
    manifest = manifestListing("devtools.98.bundle", "backend-2");
    served   = "tampered";
    assert(!updater.devtoolsScript(bundle, 98));
    assert(loader::readTextFile(cached) == std::optional<std::string>("backend"));
    assert(!loader::fileExists(cached + ".download"));

    // Another bytecode version falls back to the source build.
    manifest = manifestListing("devtools.js", "source");
    served   = "source";
    assert(updater.devtoolsScript(bundle, 96) == std::optional<std::string>("source"));
    assert(requestedURL == "https://builds.unbound.rip/devtools.js");

    std::filesystem::remove_all(root);
    return 0;
}
