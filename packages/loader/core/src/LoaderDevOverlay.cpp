#include "LoaderDevOverlay.h"

#include <algorithm>
#include <cmath>

#include "LoaderPreferences.h"

namespace loader::devoverlay {
static constexpr const char *kPositionKey = "dev-overlay.position";

const char *followUpName(FollowUp followUp)
{
    switch (followUp)
    {
        case FollowUp::None:
            return "none";
        case FollowUp::ReloadApp:
            return "reload-app";
        case FollowUp::EditSettings:
            return "edit-settings";
        case FollowUp::OpenToolbox:
            return "open-toolbox";
    }
    return "none";
}

Menu menu(const SettingsStore &settings)
{
    return {kMenuTitle,
            kCancelText,
            {
                {"reload-bundle", "Reload Bundle", FollowUp::ReloadApp},
                {"edit-settings", kSettingsEditorTitle, FollowUp::EditSettings},
                {"open-toolbox", "Open Unbound Toolbox", FollowUp::OpenToolbox},
            }};
}

nlohmann::json menuJSON(const SettingsStore &settings)
{
    const Menu     model = menu(settings);
    nlohmann::json items = nlohmann::json::array();
    for (const MenuItem &item : model.items)
    {
        items.push_back(
            {{"id", item.id}, {"title", item.title}, {"followUp", followUpName(item.followUp)}});
    }

    return {{"title", model.title},
            {"cancel", model.cancel},
            {"items", std::move(items)},
            {"editor",
             {{"title", kSettingsEditorTitle}, {"save", kSaveText}, {"cancel", kCancelText}}}};
}

SettingsEditResult saveSettings(SettingsStore &settings, const std::string &json)
{
    if (!settings.replace(json))
    {
        return {false, kInvalidSettingsMessage};
    }
    if (!settings.save())
    {
        return {false, kSettingsWriteFailedMessage};
    }
    return {true, ""};
}

nlohmann::json editResultJSON(const SettingsEditResult &result)
{
    return {{"saved", result.saved}, {"error", result.error}};
}

static double fraction(const nlohmann::json &value, const char *key, double fallback)
{
    const auto entry = value.find(key);
    if (entry == value.end() || !entry->is_number() || !std::isfinite(entry->get<double>()))
    {
        return fallback;
    }
    return std::clamp(entry->get<double>(), 0.0, 1.0);
}

Point position(const SettingsStore &settings)
{
    const auto value = settings.get(preferences::kStore, kPositionKey);
    if (!value || !value->is_object())
    {
        return kDefaultPosition;
    }
    return {fraction(*value, "x", kDefaultPosition.x), fraction(*value, "y", kDefaultPosition.y)};
}

static double clampAxis(double value, double start, double end)
{
    const double minimum = start;
    const double maximum = std::max(minimum, end);
    return std::isfinite(value) ? std::clamp(value, minimum, maximum) : minimum;
}

Point clampCenter(Point center, Size bounds, Insets insets)
{
    const double inset = kButtonSide / 2 + kButtonMargin;
    return {clampAxis(center.x, inset + insets.left, bounds.width - inset - insets.right),
            clampAxis(center.y, inset + insets.top, bounds.height - inset - insets.bottom)};
}

Point buttonCenter(const SettingsStore &settings, Size bounds, Insets insets)
{
    const Point stored = position(settings);
    return clampCenter({stored.x * bounds.width, stored.y * bounds.height}, bounds, insets);
}

bool saveButtonCenter(SettingsStore &settings, Point center, Size bounds)
{
    if (!(bounds.width > 0) || !(bounds.height > 0) || !std::isfinite(center.x) ||
        !std::isfinite(center.y))
    {
        return false;
    }
    settings.set(preferences::kStore, kPositionKey,
                 {{"x", std::clamp(center.x / bounds.width, 0.0, 1.0)},
                  {"y", std::clamp(center.y / bounds.height, 0.0, 1.0)}});
    return settings.save();
}
}
