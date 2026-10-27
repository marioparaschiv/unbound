#include <cassert>
#include <filesystem>
#include <stdexcept>
#include <string>
#include <unistd.h>

#include "LoaderFiles.h"
#include "LoaderToolbox.h"

static std::filesystem::path makeTemporaryDirectory()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-toolbox-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    return std::filesystem::path(directory);
}

static void touch(const std::filesystem::path &path)
{
    std::filesystem::create_directories(path.parent_path());
    assert(loader::writeTextFileAtomically(path.string(), "x"));
}

int main()
{
    const auto root = makeTemporaryDirectory();

    touch(root / "Plugins" / "a" / "index.js");
    touch(root / "plugins" / "legacy.js");
    touch(root / "Themes" / "t.json");
    touch(root / "Icons" / "pack" / "manifest.json");

    assert(loader::toolbox::addonKindNamed("themes") == loader::toolbox::AddonKind::Themes);
    assert(loader::toolbox::addonKindNamed("Fonts") == loader::toolbox::AddonKind::Fonts);
    assert(!loader::toolbox::addonKindNamed("Bundles"));
    assert(loader::toolbox::wipeAddons(root.string(), loader::toolbox::AddonKind::Plugins));
    assert(!std::filesystem::exists(root / "Plugins"));
    assert(!std::filesystem::exists(root / "plugins"));
    assert(std::filesystem::exists(root / "Themes"));
    assert(loader::toolbox::wipeAddons(root.string(), loader::toolbox::AddonKind::Icons));
    assert(!std::filesystem::exists(root / "Icons"));
    assert(!loader::toolbox::wipeAddons(root.string(), loader::toolbox::AddonKind::Fonts));

    loader::SettingsStore settings((root / "settings.json").string());
    settings.load();

    assert(!loader::toolbox::useCustomBundle(settings, "file:///sdcard/unbound.js"));
    assert(!loader::toolbox::useCustomBundle(settings, "https://"));
    assert(loader::toolbox::useCustomBundle(settings, "https://example.com/unbound.bundle"));
    assert(settings.getString("unbound", "loader.update.url", "") ==
           "https://example.com/unbound.bundle");
    assert(settings.getBoolean("unbound", "loader.update.force", false));

    loader::BundleUpdater updater(
        root.string(), loader::updaterSettings(settings),
        [](const std::string &, double) -> std::optional<std::string> {
            return std::nullopt;
        },
        [](const std::string &, const std::string &, const std::map<std::string, std::string> &,
           const loader::DownloadPolicy &) -> std::optional<loader::DownloadResult> {
            return std::nullopt;
        });

    touch(root / "unbound.bundle");
    touch(root / "unbound.bundle.trust");
    loader::toolbox::deleteBundle(settings, updater, root.string());
    assert(!std::filesystem::exists(root / "unbound.bundle"));
    assert(!std::filesystem::exists(root / "unbound.bundle.trust"));
    assert(settings.getString("unbound", "loader.update.url", "none") == "none");

    assert(loader::toolbox::toggleRecovery(settings));
    assert(settings.getBoolean("unbound", "recovery", false));
    assert(!loader::toolbox::toggleRecovery(settings));

    loader::toolbox::IssueReport report{
        "Android", {{"Device", "Pixel 9"}, {"Android Version", "16"}}, {{"Logs", "line"}}};
    const std::string body = loader::toolbox::issueBody(report);
    assert(body.find("- **Device**: Pixel 9\n") != std::string::npos);
    assert(body.find("### Logs\n```\nline\n```") != std::string::npos);

    const std::string url = loader::toolbox::issueURL(report);
    assert(url.rfind("https://github.com/marioparaschiv/unbound/issues/new?title=bug%28Android%29",
                     0) == 0);
    assert(url.find(' ') == std::string::npos);

    assert(loader::toolbox::useCustomBundle(settings, "  https://example.com/padded.bundle \n"));
    assert(settings.getString("unbound", "loader.update.url", "") ==
           "https://example.com/padded.bundle");

    loader::BundleUpdater failing(
        root.string(), loader::updaterSettings(settings),
        [](const std::string &, double) -> std::optional<std::string> {
            return std::nullopt;
        },
        [](const std::string &, const std::string &, const std::map<std::string, std::string> &,
           const loader::DownloadPolicy &) -> std::optional<loader::DownloadResult> {
            throw std::runtime_error("offline");
        });
    assert(!loader::toolbox::refetchBundle(failing,
                                           std::string("https://example.com/unbound.bundle"), 96));

    loader::toolbox::ToolboxContext context{settings,
                                            failing,
                                            root.string(),
                                            "iOS",
                                            [] {
                                                return std::optional<std::string>();
                                            },
                                            [] {
                                                return 96u;
                                            }};
    assert(loader::toolbox::perform(context, "refetch-bundle", "") == "false");
    assert(loader::toolbox::perform(context, "custom-bundle", "ftp://nope") == "false");
    assert(loader::toolbox::perform(context, "settings", "").find("padded.bundle") !=
           std::string::npos);
    assert(loader::toolbox::perform(context, "unknown", "").empty());
    const auto rows = loader::toolbox::issueEnvironment(
        {"Android", "Pixel", "16", "350.8", "1.0.0", "", "", true});
    assert(rows.size() == 5);
    assert(rows[1].first == "Android Version");
    assert(rows.back().first == "Virtual Device" && rows.back().second == "Yes");

    assert(loader::toolbox::factoryReset(root.string()));
    assert(loader::listDirectory(root.string()).empty());

    std::filesystem::remove_all(root);
    return 0;
}
