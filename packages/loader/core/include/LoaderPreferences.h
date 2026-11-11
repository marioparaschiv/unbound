#pragma once

#include <nlohmann/json.hpp>
#include <optional>
#include <string>

#include "LoaderColor.h"
#include "LoaderSettings.h"

// The loader's settings: the only module that knows their bucket and keys. Every other module
// reads and writes them through these typed accessors over a SettingsStore. A setter saves the
// file only when the value changed, unless it says otherwise.
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
// Always saves, so the toggle reports whether the file was written.
bool setRecoveryEnabled(SettingsStore &settings, bool enabled);
bool developerMode(const SettingsStore &settings);
bool devOverlayVisible(const SettingsStore &settings, bool virtualDevice, bool debugBuild);
bool hotReloadEnabled(const SettingsStore &settings);
// Whether React's DevTools backend runs before the bundle.
bool devtoolsEnabled(const SettingsStore &settings);
// Whether Discord's analytics requests are answered locally. Absent means on.
bool telemetryBlocked(const SettingsStore &settings);

// The bundle URL the user set, or empty for the default.
std::string updateURL(const SettingsStore &settings);
// Whether a fresh bundle downloads at every launch.
bool forceUpdate(const SettingsStore &settings);
// Points the updater at `url` and forces a fresh download; always saves.
bool setCustomBundle(SettingsStore &settings, const std::string &url);
// Drops the custom bundle URL and the forced download; always saves.
bool clearCustomBundle(SettingsStore &settings);
// Whether bundles run without a valid signature.
bool unsignedBundlesAllowed(const SettingsStore &settings);
// The Updates screen's switch for automatic client updates. Absent means on.
bool autoClientUpdates(const SettingsStore &settings);

// The ETag of the bundle last downloaded, or empty.
std::string bundleEtag(const SettingsStore &settings);
void        setBundleEtag(SettingsStore &settings, const std::string &etag);
// The bundle record a promotion replaced, so a rollback can restore it; empty when none.
std::string bundleBaseline(const SettingsStore &settings);
void        setBundleBaseline(SettingsStore &settings, const std::string &record);
// The loader version that last checked for a bundle, so a loader update is noticed once.
std::string checkedByLoader(const SettingsStore &settings);
void        setCheckedByLoader(SettingsStore &settings, const std::string &version);

std::optional<std::string> appliedThemeId(const SettingsStore &settings);
std::optional<std::string> activeThemeId(const SettingsStore &settings);
nlohmann::json             fontOverrides(const SettingsStore &settings);

std::optional<ToolboxGesture> gestureNamed(const std::string &name);
const char                   *gestureName(ToolboxGesture gesture);
bool                          gestureEnabled(const SettingsStore &settings, ToolboxGesture gesture);
bool setGestureEnabled(SettingsStore &settings, ToolboxGesture gesture, bool enabled);

std::string recoveryActionLabel(bool enabled);
std::string recoveryStatusText(bool enabled);
}
