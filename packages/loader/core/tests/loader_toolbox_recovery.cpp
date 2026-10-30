#include <cassert>
#include <filesystem>
#include <string>
#include <unistd.h>
#include <vector>

#include "LoaderLog.h"
#include "LoaderToolbox.h"

static std::filesystem::path makeTemporaryDirectory()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-toolbox-recovery-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    return std::filesystem::path(directory);
}

int main()
{
    std::vector<std::string> lines;
    loader::setLogSink(
        [&lines](loader::LogLevel, const std::string &category, const std::string &message) {
            lines.push_back(category + ": " + message);
        });

    const auto            root = makeTemporaryDirectory();
    loader::SettingsStore settings((root / "settings.json").string());
    settings.load();

    const auto enabled = loader::toolbox::toggleRecoveryFromShortcut(settings, false);
    assert(enabled.enabled && !enabled.restartRequired);
    assert(enabled.status == "Recovery Mode enabled");
    assert(settings.getBoolean("astral", "recovery", false));
    assert(lines.size() == 1 &&
           lines.back() == "default: Recovery shortcut: Recovery Mode enabled.");

    const auto disabled = loader::toolbox::toggleRecoveryFromShortcut(settings, true);
    assert(!disabled.enabled && disabled.restartRequired);
    assert(disabled.status == "Recovery Mode disabled");
    assert(lines.size() == 2);

    loader::BundleUpdater updater(
        root.string(), loader::updaterSettings(settings),
        [](const std::string &, double) -> std::optional<std::string> {
            return std::nullopt;
        },
        [](const std::string &, const std::string &, const std::map<std::string, std::string> &,
           const loader::DownloadPolicy &) -> std::optional<loader::DownloadResult> {
            return std::nullopt;
        });
    bool                            ready = true;
    loader::toolbox::ToolboxContext context{settings,
                                            updater,
                                            root.string(),
                                            "Android",
                                            [] {
                                                return std::optional<std::string>();
                                            },
                                            [] {
                                                return 96u;
                                            },
                                            [&ready] {
                                                return ready;
                                            }};

    const nlohmann::json first =
        nlohmann::json::parse(loader::toolbox::perform(context, "recovery-shortcut", ""));
    assert(first["enabled"] == true && first["restartRequired"] == true);
    assert(first["status"] == "Recovery Mode enabled");

    ready = false;
    const nlohmann::json second =
        nlohmann::json::parse(loader::toolbox::perform(context, "recovery-shortcut", ""));
    assert(second["enabled"] == false && second["restartRequired"] == false);

    loader::toolbox::ToolboxContext unready{settings,
                                            updater,
                                            root.string(),
                                            "iOS",
                                            [] {
                                                return std::optional<std::string>();
                                            },
                                            [] {
                                                return 96u;
                                            }};
    const nlohmann::json            third =
        nlohmann::json::parse(loader::toolbox::perform(unready, "recovery-shortcut", ""));
    assert(third["restartRequired"] == false);

    assert(loader::toolbox::perform(context, "recovery-shortcut-action", "") ==
           "app.astral.recovery.toggle");

    ready                               = true;
    const bool           recoveryBefore = settings.getBoolean("astral", "recovery", false);
    const nlohmann::json ignored        = nlohmann::json::parse(
        loader::toolbox::perform(context, "recovery-shortcut-activate", "com.discord.search"));
    assert(ignored == nlohmann::json({{"handled", false}}));
    assert(settings.getBoolean("astral", "recovery", false) == recoveryBefore);
    assert(!loader::toolbox::activateShortcut(settings, true, ""));

    const nlohmann::json activated = nlohmann::json::parse(loader::toolbox::perform(
        context, "recovery-shortcut-activate", loader::toolbox::kRecoveryShortcutAction));
    assert(activated["handled"] == true && activated["restartRequired"] == true);
    assert(activated["enabled"] == !recoveryBefore);
    assert(activated["status"] ==
           (recoveryBefore ? "Recovery Mode disabled" : "Recovery Mode enabled"));
    assert(settings.getBoolean("astral", "recovery", false) == !recoveryBefore);

    const auto direct = loader::toolbox::activateShortcut(settings, false,
                                                          loader::toolbox::kRecoveryShortcutAction);
    assert(direct && direct->enabled == recoveryBefore && !direct->restartRequired);

    using Indices = std::vector<size_t>;
    assert(loader::toolbox::shortcutsAfterRecovery({}) == Indices{});
    assert((loader::toolbox::shortcutsAfterRecovery(
                {"search", loader::toolbox::kRecoveryShortcutAction, "dm", "search"}) ==
            Indices{0, 2, 3}));
    assert(loader::toolbox::shortcutsAfterRecovery(
               {loader::toolbox::kRecoveryShortcutAction, loader::toolbox::kRecoveryShortcutAction})
               .empty());
    assert(loader::toolbox::perform(context, "recovery-shortcut-order",
                                    "[\"a\",\"app.astral.recovery.toggle\",\"b\"]") == "[0,2]");
    assert(loader::toolbox::perform(context, "recovery-shortcut-order", "[1,\"b\"]") == "[0,1]");
    assert(loader::toolbox::perform(context, "recovery-shortcut-order", "nonsense") == "[]");

    loader::setLogSink(nullptr);
    std::filesystem::remove_all(root);
    return 0;
}
