#pragma once

#include <nlohmann/json.hpp>
#include <optional>
#include <string>

#include "LoaderColor.h"
#include "LoaderSettings.h"

namespace loader::preferences {
constexpr const char *kStore         = "unbound";
constexpr const char *kThemesStore   = "themes";
constexpr const char *kSettingsFile  = "settings.json";
constexpr const char *kDocumentsName = "Unbound";

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
const char                   *gestureName(ToolboxGesture gesture);
bool                          gestureEnabled(const SettingsStore &settings, ToolboxGesture gesture);
bool setGestureEnabled(SettingsStore &settings, ToolboxGesture gesture, bool enabled);

std::string recoveryActionLabel(bool enabled);
std::string recoveryStatusText(bool enabled);

std::string perform(SettingsStore &settings, const std::string &action,
                    const std::string &argument);
}
