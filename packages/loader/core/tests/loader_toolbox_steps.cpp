#include <cassert>
#include <filesystem>
#include <string>
#include <unistd.h>

#include "LoaderToolbox.h"

using loader::toolbox::MenuOutcome;
using loader::toolbox::MenuStep;

static std::filesystem::path makeTemporaryDirectory()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-toolbox-steps-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    return std::filesystem::path(directory);
}

static nlohmann::json menuItem(const nlohmann::json &menu, const std::string &id)
{
    for (const auto &section : menu["sections"])
    {
        for (const auto &item : section["items"])
        {
            if (item["id"] == id)
            {
                return item;
            }
        }
    }
    assert(false);
    return nullptr;
}

static void checkMenuSteps(const nlohmann::json &menu)
{
    using loader::toolbox::menuStep;
    assert(menuStep(menuItem(menu, "refetch-bundle"), false) == MenuStep::Run);
    assert(menuStep(menuItem(menu, "delete-bundle"), false) == MenuStep::Confirm);
    assert(menuStep(menuItem(menu, "delete-bundle"), true) == MenuStep::Run);
    assert(menuStep(menuItem(menu, "custom-bundle"), false) == MenuStep::Prompt);
    assert(menuStep(menuItem(menu, "factory-reset"), false) == MenuStep::Confirm);
    assert(menuStep(menuItem(menu, "open-issue"), false) == MenuStep::Platform);
    assert(menuStep(menuItem(menu, "open-app-folder"), true) == MenuStep::Platform);
    assert(menuStep(menuItem(menu, "gesture-shake"), false) == MenuStep::None);
    assert(menuStep(menuItem(menu, "unbound-icon"), true) == MenuStep::None);
}

static void checkMenuOutcomes(const nlohmann::json &menu)
{
    using loader::toolbox::menuOutcome;
    assert(menuOutcome(menuItem(menu, "refetch-bundle"), "true") == MenuOutcome::Restart);
    assert(menuOutcome(menuItem(menu, "refetch-bundle"), "false") == MenuOutcome::Failed);
    assert(menuOutcome(menuItem(menu, "custom-bundle"), "") == MenuOutcome::Failed);
    assert(menuOutcome(menuItem(menu, "wipe-plugins"), "false") == MenuOutcome::Restart);
    assert(menuOutcome(menuItem(menu, "toggle-recovery"), "true") == MenuOutcome::Restart);
    assert(menuOutcome(nlohmann::json{{"failure", ""}}, "false") == MenuOutcome::Done);
    assert(menuOutcome(nlohmann::json{{"restartsApp", false}}, "true") == MenuOutcome::Done);
    assert(menuOutcome(nullptr, "") == MenuOutcome::Done);
}

int main()
{
    const auto            root = makeTemporaryDirectory();
    loader::SettingsStore settings((root / "settings.json").string());
    settings.load();

    const nlohmann::json menu = loader::toolbox::menuJSON(
        settings, loader::toolbox::menuOptions(R"({"openAppFolder":true,"unboundIcon":true})"));
    checkMenuSteps(menu);
    checkMenuOutcomes(menu);

    const auto numeric = loader::toolbox::menuOptions(R"({"openAppFolder":1,"unboundIcon":0})");
    assert(numeric.openAppFolder && !numeric.unboundIcon && !numeric.copyAppFolderPath);
    const auto mixed =
        loader::toolbox::menuOptions(R"({"openAppFolder":"yes","unboundIcon":true})");
    assert(!mixed.openAppFolder && mixed.unboundIcon);

    assert(loader::toolbox::menuStep(nullptr, false) == MenuStep::None);
    assert(loader::toolbox::menuStep(nlohmann::json::object(), false) == MenuStep::Run);
    assert(loader::toolbox::menuStep(nlohmann::json{{"prompt", "text"}}, false) == MenuStep::Run);

    loader::BundleUpdater updater(
        root.string(), loader::updaterSettings(settings),
        [](const std::string &, double) -> std::optional<std::string> {
            return std::nullopt;
        },
        [](const std::string &, const std::string &, const std::map<std::string, std::string> &,
           const loader::DownloadPolicy &) -> std::optional<loader::DownloadResult> {
            return std::nullopt;
        });
    loader::toolbox::ToolboxContext context{settings, updater, root.string(), "Android"};

    const nlohmann::json destructive = menuItem(menu, "delete-bundle");
    assert(loader::toolbox::perform(context, "menu-step",
                                    nlohmann::json{{"item", destructive}}.dump()) == "confirm");
    assert(loader::toolbox::perform(
               context, "menu-step",
               nlohmann::json{{"item", destructive}, {"confirmed", true}}.dump()) == "run");
    assert(loader::toolbox::perform(
               context, "menu-step",
               nlohmann::json{{"item", menuItem(menu, "custom-bundle")}}.dump()) == "prompt");
    assert(loader::toolbox::perform(
               context, "menu-step",
               nlohmann::json{{"item", menuItem(menu, "open-issue")}}.dump()) == "platform");
    assert(loader::toolbox::perform(context, "menu-step", "not json") == "none");

    const nlohmann::json refetch = menuItem(menu, "refetch-bundle");
    assert(loader::toolbox::perform(
               context, "menu-outcome",
               nlohmann::json{{"item", refetch}, {"result", "false"}}.dump()) == "failed");
    assert(loader::toolbox::perform(context, "menu-outcome",
                                    nlohmann::json{{"item", refetch}}.dump()) == "failed");
    assert(loader::toolbox::perform(context, "menu-outcome",
                                    nlohmann::json{{"item", refetch}, {"result", "true"}}.dump()) ==
           "restart");
    assert(loader::toolbox::perform(
               context, "menu-outcome",
               nlohmann::json{{"item", menuItem(menu, "open-issue")}, {"result", "true"}}.dump()) ==
           "done");
    assert(loader::toolbox::perform(context, "menu-outcome", "[]") == "done");

    assert(!loader::toolbox::isShakeGesture(0.49));
    assert(loader::toolbox::isShakeGesture(0.5));
    assert(loader::toolbox::isShakeGesture(1.2));
    assert(loader::toolbox::isShakeGesture(2.0));
    assert(!loader::toolbox::isShakeGesture(2.01));
    assert(!loader::toolbox::isShakeGesture(-1));

    assert(loader::toolbox::discordVersionLabel("352.0", "86457") == "352.0 (86457)");
    assert(loader::toolbox::discordVersionLabel("352.0", "") == "352.0 ()");
    assert(loader::toolbox::discordVersionLabel(std::nullopt, "86457").empty());

    assert((loader::toolbox::appFolderURLs("/var/mobile/Documents/Unbound", true) ==
            std::vector<std::string>{"filza://view/var/mobile/Documents/Unbound",
                                     "shareddocuments:///var/mobile/Documents/Unbound"}));
    assert((loader::toolbox::appFolderURLs("/private/Documents/Unbound", false) ==
            std::vector<std::string>{"shareddocuments:///private/Documents/Unbound"}));

    std::filesystem::remove_all(root);
    return 0;
}
