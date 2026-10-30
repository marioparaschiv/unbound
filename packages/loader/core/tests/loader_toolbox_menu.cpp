#include <cassert>
#include <filesystem>
#include <string>
#include <unistd.h>

#include "LoaderToolbox.h"

static std::filesystem::path makeTemporaryDirectory()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-toolbox-menu-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    return std::filesystem::path(directory);
}

static std::vector<std::string> ids(const loader::toolbox::MenuSection &section)
{
    std::vector<std::string> result;
    for (const auto &item : section.items)
    {
        result.push_back(item.id);
    }
    return result;
}

static const loader::toolbox::MenuItem &item(const std::vector<loader::toolbox::MenuSection> &menu,
                                             const std::string                               &id)
{
    for (const auto &section : menu)
    {
        for (const auto &entry : section.items)
        {
            if (entry.id == id)
            {
                return entry;
            }
        }
    }
    assert(false);
    return menu.front().items.front();
}

int main()
{
    const auto            root = makeTemporaryDirectory();
    loader::SettingsStore settings((root / "settings.json").string());
    settings.load();

    const auto plain = loader::toolbox::menu(settings, {});
    assert(plain.size() == 4);
    assert(plain[0].title == "Bundle" && plain[1].title == "Addons");
    assert(plain[2].title == "Utilities" && plain[3].title == "Settings");
    assert((ids(plain[0]) ==
            std::vector<std::string>{"refetch-bundle", "delete-bundle", "custom-bundle"}));
    assert((ids(plain[1]) ==
            std::vector<std::string>{"wipe-plugins", "wipe-themes", "wipe-fonts", "wipe-icons"}));
    assert((ids(plain[2]) ==
            std::vector<std::string>{"toggle-recovery", "factory-reset", "open-issue"}));
    assert((ids(plain[3]) == std::vector<std::string>{"gesture-shake", "gesture-three-finger"}));

    const auto &icons = item(plain, "wipe-icons");
    assert(icons.title == "Wipe Icon Packs");
    assert(icons.action == "wipe" && icons.argument == "Icons");
    assert(icons.destructive && icons.restartsApp);

    for (const char *destructive :
         {"delete-bundle", "wipe-plugins", "wipe-themes", "wipe-fonts", "factory-reset"})
    {
        assert(item(plain, destructive).destructive);
    }
    for (const char *safe : {"refetch-bundle", "custom-bundle", "toggle-recovery", "open-issue"})
    {
        assert(!item(plain, safe).destructive);
    }

    const auto &refetch = item(plain, "refetch-bundle");
    assert(refetch.progress == loader::toolbox::kRefetchProgressMessage);
    assert(refetch.failure == loader::toolbox::kRefetchFailedMessage);
    assert(refetch.restartsApp);

    const auto &custom = item(plain, "custom-bundle");
    assert(custom.prompt);
    assert(custom.prompt->placeholder == "https://example.com/unbound.bundle");
    assert(custom.prompt->confirm == "Download" && custom.prompt->cancel == "Cancel");
    assert(custom.failure == loader::toolbox::kCustomBundleInvalidText);

    assert(item(plain, "open-issue").kind == loader::toolbox::MenuItemKind::Platform);
    assert(item(plain, "open-issue").failure == loader::toolbox::kIssueFailedMessage);
    assert(item(plain, "toggle-recovery").title == "Enable Recovery Mode");

    const auto &shake = item(plain, "gesture-shake");
    assert(shake.kind == loader::toolbox::MenuItemKind::Toggle);
    assert(shake.gesture == loader::preferences::ToolboxGesture::Shake && shake.on);

    loader::preferences::setRecoveryEnabled(settings, true);
    loader::preferences::setGestureEnabled(settings, loader::preferences::ToolboxGesture::Shake,
                                           false);
    const auto ios = loader::toolbox::menu(
        settings, loader::toolbox::menuOptions(R"({"openAppFolder":true,"astralIcon":true})"));
    assert(item(ios, "toggle-recovery").title == "Disable Recovery Mode");
    assert(!item(ios, "gesture-shake").on);
    assert(item(ios, "gesture-three-finger").on);
    assert((ids(ios[2]) == std::vector<std::string>{"toggle-recovery", "factory-reset",
                                                    "open-app-folder", "open-issue"}));
    assert((ids(ios[3]) ==
            std::vector<std::string>{"gesture-shake", "gesture-three-finger", "astral-icon"}));
    assert(item(ios, "astral-icon").kind == loader::toolbox::MenuItemKind::Toggle);
    assert(!item(ios, "astral-icon").gesture);

    const auto android = loader::toolbox::menu(
        settings, loader::toolbox::menuOptions(R"({"copyAppFolderPath":true})"));
    assert((ids(android[2]) == std::vector<std::string>{"toggle-recovery", "factory-reset",
                                                        "copy-app-folder-path", "open-issue"}));
    assert(ids(android[3]).size() == 2);
    assert(loader::toolbox::menuOptions("not json").openAppFolder == false);

    const nlohmann::json json = loader::toolbox::menuJSON(settings, {});
    assert(json["title"] == "astral Toolbox");
    assert(json["close"] == "Close");
    assert(json["confirmation"]["message"] == loader::toolbox::kDestructiveConfirmation);
    assert(json["confirmation"]["confirm"] == "Confirm");
    assert(json["sections"].size() == 4);
    const nlohmann::json first = json["sections"][0]["items"][0];
    assert(first["id"] == "refetch-bundle" && first["kind"] == "action");
    assert(first["action"] == "refetch-bundle" && first["restartsApp"] == true);
    assert(first["progress"] == loader::toolbox::kRefetchProgressMessage);
    assert(!first.contains("argument") && !first.contains("prompt"));
    assert(json["sections"][0]["items"][2]["prompt"]["title"] == "Custom Bundle URL");
    assert(json["sections"][1]["items"][3]["argument"] == "Icons");
    assert(json["sections"][3]["items"][0]["gesture"] == "shake");
    assert(json["sections"][3]["items"][0]["on"] == false);
    assert(json["sections"][2]["items"][2]["kind"] == "platform");

    loader::BundleUpdater updater(
        root.string(), loader::updaterSettings(settings),
        [](const std::string &, double) -> std::optional<std::string> {
            return std::nullopt;
        },
        [](const std::string &, const std::string &, const std::map<std::string, std::string> &,
           const loader::DownloadPolicy &) -> std::optional<loader::DownloadResult> {
            return std::nullopt;
        });
    loader::toolbox::ToolboxContext context{settings,
                                            updater,
                                            root.string(),
                                            "Android",
                                            [] {
                                                return std::optional<std::string>();
                                            },
                                            [] {
                                                return 96u;
                                            }};
    const nlohmann::json            performed = nlohmann::json::parse(
        loader::toolbox::perform(context, "menu", R"({"copyAppFolderPath":true})"));
    assert(performed["sections"][2]["items"][2]["id"] == "copy-app-folder-path");
    assert(loader::toolbox::perform(context, "hold-milliseconds", "") == "500");
    assert(loader::toolbox::perform(context, "message", "refetch-failed").empty());

    std::filesystem::remove_all(root);
    return 0;
}
