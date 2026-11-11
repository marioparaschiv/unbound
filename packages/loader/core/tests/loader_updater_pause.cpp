#include <cassert>
#include <cstring>
#include <filesystem>
#include <string>
#include <unistd.h>

#include "HermesBytecodeHeader.h"
#include "LoaderFiles.h"
#include "LoaderToolbox.h"
#include "LoaderUpdater.h"

static std::filesystem::path makeTemporaryDirectory()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-updater-pause-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    return std::filesystem::path(directory);
}

static std::string hermesBundle(uint32_t version)
{
    std::string bundle(64, '\0');
    std::memcpy(bundle.data(), &loader::kHermesMagic, sizeof(loader::kHermesMagic));
    std::memcpy(bundle.data() + sizeof(loader::kHermesMagic), &version, sizeof(version));
    return bundle;
}

int main()
{
    const auto  root      = makeTemporaryDirectory();
    const auto  documents = root.string();
    const auto  active    = (root / "unbound.bundle").string();
    const auto  candidate = active + ".candidate";
    std::string body      = "bundle";
    int         downloads = 0;
    int         fetches   = 0;

    loader::SettingsStore settings((root / "settings.json").string());
    settings.load();
    settings.set("unbound", "updater.auto.client", false);

    loader::BundleUpdater updater(
        documents, settings,
        [&](const std::string &, double) -> std::optional<std::string> {
            fetches++;
            return std::string(R"({"bytecodeVersions":[98]})");
        },
        [&](const std::string &, const std::string &destination,
            const std::map<std::string, std::string> &,
            const loader::DownloadPolicy &) -> std::optional<loader::DownloadResult> {
            downloads++;
            assert(loader::writeTextFileAtomically(destination, body));
            return loader::DownloadResult{200, "\"etag-1\""};
        },
        loader::BundleTrust{});

    // Paused with no bundle yet: the first launch still downloads one.
    std::string first = updater.downloadBundle(updater.resolveBundlePath(), std::nullopt, 98);
    assert(first == candidate && downloads == 1);
    assert(updater.markBundleAttempted(first) && updater.acceptBundle(first));

    // Paused with a verified cached bundle: no manifest fetch, no download.
    fetches          = 0;
    std::string kept = updater.downloadBundle(updater.resolveBundlePath(), std::nullopt, 98);
    assert(kept == active && downloads == 1 && fetches == 0);

    // A manual refetch from the toolbox overrides the pause and downloads.
    assert(loader::toolbox::refetchBundle(updater, std::nullopt, 98));
    assert(downloads == 2 && fetches > 0);
    updater.rejectBundle(candidate);
    assert(updater.downloadBundle(active, std::nullopt, 98) == active && downloads == 2);

    // Force, a custom source and hot reload each win over the pause.
    settings.set("unbound", "loader.update.force", true);
    assert(updater.downloadBundle(active, std::nullopt, 98) == candidate && downloads == 3);
    updater.rejectBundle(candidate);
    settings.set("unbound", "loader.update.force", false);

    assert(updater.downloadBundle(active, std::string("http://10.0.2.2:3000/"), 98) == candidate);
    assert(downloads == 4);
    updater.rejectBundle(candidate);

    settings.set("unbound", "loader.update.hmr", true);
    assert(updater.downloadBundle(active, std::nullopt, 98) == candidate && downloads == 5);
    updater.rejectBundle(candidate);
    settings.set("unbound", "loader.update.hmr", false);

    // A cached bundle built for another bytecode version cannot be kept.
    assert(loader::writeTextFileAtomically(active, hermesBundle(96)));
    assert(updater.downloadBundle(active, std::nullopt, 98) == candidate && downloads == 6);
    updater.rejectBundle(candidate);
    assert(loader::writeTextFileAtomically(active, hermesBundle(98)));
    assert(updater.downloadBundle(active, std::nullopt, 98) == active && downloads == 6);

    // A cached bundle without a verification record cannot be kept either.
    loader::removeFile(active + loader::kBundleTrustSuffix);
    assert(updater.downloadBundle(active, std::nullopt, 98) == candidate && downloads == 7);

    std::filesystem::remove_all(root);
    return 0;
}
