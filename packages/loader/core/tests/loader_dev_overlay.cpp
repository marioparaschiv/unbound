#include "LoaderDevOverlay.h"
#include "LoaderFiles.h"
#include "LoaderPreferences.h"
#include "LoaderToolbox.h"

#include <cassert>
#include <cmath>
#include <filesystem>
#include <string>
#include <unistd.h>

using namespace loader::devoverlay;

static bool near(double value, double expected)
{
    return std::fabs(value - expected) < 1e-9;
}

static std::vector<std::string> ids(const Menu &menu)
{
    std::vector<std::string> result;
    for (const auto &item : menu.items)
    {
        result.push_back(item.id);
    }
    return result;
}

int main()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-dev-overlay-XXXXXX").string();
    assert(mkdtemp(templatePath.data()));
    const auto            path = (std::filesystem::path(templatePath) / "settings.json").string();
    loader::SettingsStore settings(path);
    settings.load();

    const Menu plain = menu(settings);
    assert(plain.title == "Developer" && plain.cancel == "Cancel");
    assert((ids(plain) == std::vector<std::string>{"message-bubbles", "avatar-radius", "reload-bundle",
                                                   "edit-settings", "open-toolbox"}));
    assert(plain.items[0].title == "Message Bubbles: Off");
    assert(plain.items[0].action == "toggle-message-bubbles");
    assert(plain.items[0].followUp == FollowUp::ReloadChat);
    assert(plain.items[1].title == "Avatar Radius: Circular");
    assert(plain.items[1].action == "cycle-avatar-radius");
    assert(plain.items[2].action.empty() && plain.items[2].followUp == FollowUp::ReloadApp);
    assert(plain.items[3].title == kSettingsEditorTitle && plain.items[3].followUp == FollowUp::EditSettings);
    assert(plain.items[4].followUp == FollowUp::OpenToolbox);

    loader::preferences::setMessageBubbles(settings, true);
    loader::preferences::cycleAvatarRadius(settings);
    const nlohmann::json json = menuJSON(settings);
    assert(json["title"] == "Developer" && json["cancel"] == "Cancel");
    assert(json["items"].size() == 5);
    assert(json["items"][0]["title"] == "Message Bubbles: On");
    assert(json["items"][1]["title"] == "Avatar Radius: 0pt");
    assert(json["items"][2]["followUp"] == "reload-app");
    assert(json["items"][3]["followUp"] == "edit-settings");
    assert(json["editor"]["title"] == "Edit Settings JSON");
    assert(json["editor"]["save"] == "Save" && json["editor"]["cancel"] == "Cancel");

    const SettingsEditResult syntax = saveSettings(settings, "{\"unbound\":");
    assert(!syntax.saved && syntax.error == kInvalidSettingsMessage);
    const SettingsEditResult array = saveSettings(settings, "[]");
    assert(!array.saved && array.error == kInvalidSettingsMessage);
    assert(loader::preferences::messageBubbles(settings));

    const SettingsEditResult saved = saveSettings(settings, "{\"unbound\":{\"developer-mode\":true}}");
    assert(saved.saved && saved.error.empty());
    assert(loader::preferences::developerMode(settings));
    assert(!loader::preferences::messageBubbles(settings));
    assert(editResultJSON(saved) == nlohmann::json({{"saved", true}, {"error", ""}}));
    assert(editResultJSON(syntax)["error"] == kInvalidSettingsMessage);

    loader::BundleUpdater updater(
        templatePath, loader::updaterSettings(settings),
        [](const std::string &, double) -> std::optional<std::string> { return std::nullopt; },
        [](const std::string &, const std::string &, const std::map<std::string, std::string> &,
           const loader::DownloadPolicy &) -> std::optional<loader::DownloadResult> { return std::nullopt; });
    loader::toolbox::ToolboxContext context{settings, updater, templatePath, "Test", {}, {}, {}};
    assert(nlohmann::json::parse(loader::toolbox::perform(context, "developer-menu", ""))["items"].size() == 5);
    assert(nlohmann::json::parse(loader::toolbox::perform(context, "save-settings", "nope"))["saved"] == false);
    assert(nlohmann::json::parse(loader::toolbox::perform(context, "save-settings", "{}"))["saved"] == true);
    assert(!loader::preferences::developerMode(settings));

    const Size   phone{375, 667};
    const Insets safe{20, 0, 34, 0};
    const Point  defaults = position(settings);
    assert(near(defaults.x, kDefaultPosition.x) && near(defaults.y, kDefaultPosition.y));

    const Point initial = buttonCenter(settings, phone, safe);
    assert(near(initial.x, 375 - 30) && near(initial.y, 667 * 0.8));

    const Point corner = clampCenter({-50, 10000}, phone, safe);
    assert(near(corner.x, 30) && near(corner.y, 667 - 30 - 34));
    const Point top = clampCenter({100, 0}, phone, safe);
    assert(near(top.y, 50));
    const Point tiny = clampCenter({5, 5}, {40, 40}, {});
    assert(near(tiny.x, 30) && near(tiny.y, 30));
    const Point invalid = clampCenter({NAN, INFINITY}, phone, {});
    assert(near(invalid.x, 30) && near(invalid.y, 30));

    assert(saveButtonCenter(settings, {187.5, 333.5}, phone));
    const Point stored = position(settings);
    assert(near(stored.x, 0.5) && near(stored.y, 0.5));
    const auto raw = settings.get("unbound", "dev-overlay.position");
    assert(raw && raw->is_object() && near((*raw)["x"].get<double>(), 0.5));
    const Point resized = buttonCenter(settings, {800, 400}, {});
    assert(near(resized.x, 400) && near(resized.y, 200));

    assert(saveButtonCenter(settings, {900, -10}, phone));
    assert(near(position(settings).x, 1) && near(position(settings).y, 0));
    assert(!saveButtonCenter(settings, {10, 10}, {0, 100}));
    assert(!saveButtonCenter(settings, {NAN, 10}, phone));

    settings.set("unbound", "dev-overlay.position", {{"x", "left"}, {"y", 3}});
    assert(near(position(settings).x, kDefaultPosition.x) && near(position(settings).y, 1));
    settings.set("unbound", "dev-overlay.position", 4);
    assert(near(position(settings).y, kDefaultPosition.y));

    std::filesystem::remove_all(templatePath);
    return 0;
}
