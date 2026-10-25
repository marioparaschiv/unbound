#pragma once

#include <array>
#include <optional>
#include <string>

#include <nlohmann/json.hpp>

#include "LoaderSettings.h"

namespace loader::preferences
{
    constexpr const char *kStore         = "unbound";
    constexpr const char *kThemesStore   = "themes";
    constexpr const char *kSettingsFile  = "settings.json";
    constexpr const char *kDocumentsName = "Unbound";

    constexpr std::array<double, 4> kAvatarRadiusPresets = {0, 8, 16, 20};

    struct MessageBubbleStyle
    {
        double      radius            = 10;
        double      horizontalPadding = 8;
        double      verticalPadding   = 4;
        const char *darkColor         = "#00000066";
        const char *lightColor        = "#FFFFFF66";
    };

    constexpr MessageBubbleStyle kMessageBubbleStyle{};

    enum class ToolboxGesture
    {
        Shake,
        ThreeFinger,
    };

    bool loaderEnabled(const SettingsStore &settings);
    bool recoveryEnabled(const SettingsStore &settings);
    bool setRecoveryEnabled(SettingsStore &settings, bool enabled);
    bool developerMode(const SettingsStore &settings);
    bool devOverlayVisible(const SettingsStore &settings, bool virtualDevice, bool debugBuild);
    bool hotReloadEnabled(const SettingsStore &settings);

    std::optional<std::string> appliedThemeId(const SettingsStore &settings);
    std::optional<std::string> activeThemeId(const SettingsStore &settings);
    nlohmann::json             fontOverrides(const SettingsStore &settings);

    std::optional<ToolboxGesture> gestureNamed(const std::string &name);
    bool gestureEnabled(const SettingsStore &settings, ToolboxGesture gesture);
    bool setGestureEnabled(SettingsStore &settings, ToolboxGesture gesture, bool enabled);

    bool                  messageBubbles(const SettingsStore &settings);
    bool                  setMessageBubbles(SettingsStore &settings, bool enabled);
    std::optional<double> avatarRadius(const SettingsStore &settings);
    std::optional<double> nextAvatarRadius(std::optional<double> current);
    std::optional<double> cycleAvatarRadius(SettingsStore &settings);
    std::string           recoveryActionLabel(bool enabled);
    std::string           recoveryStatusText(bool enabled);
    std::string           messageBubblesLabel(bool enabled);
    std::string           avatarRadiusLabel(std::optional<double> radius);

    std::string perform(SettingsStore &settings, const std::string &action, const std::string &argument);
}
