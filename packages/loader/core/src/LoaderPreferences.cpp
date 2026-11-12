#include "LoaderPreferences.h"

#include <cstdio>

namespace loader::preferences {
static constexpr const char *kRecovery             = "recovery";
static constexpr const char *kDeveloperMode        = "developer-mode";
static constexpr const char *kHotReload            = "loader.update.hmr";
static constexpr const char *kLoaderEnabled        = "loader.enabled";
static constexpr const char *kDevtools             = "loader.devtools";
static constexpr const char *kBlockTelemetry       = "loader.telemetry.block";
static constexpr const char *kUpdateURL            = "loader.update.url";
static constexpr const char *kForceUpdate          = "loader.update.force";
static constexpr const char *kUnsignedBundles      = "loader.update.unsigned";
static constexpr const char *kAutoClientUpdate     = "updater.auto.client";
static constexpr const char *kWaitForWifi          = "loader.update.waitForWifi";
static constexpr const char *kBundleEtag           = "loader.update.etag";
static constexpr const char *kRejectedRevision     = "loader.update.rejectedRevision";
static constexpr const char *kAutomaticRecoveryKey = "loader.recovery.automaticFrom";
static constexpr const char *kBundleBaseline       = "loader.update.baseline";
static constexpr const char *kCheckedByLoader      = "loader.update.checkedBy";
static constexpr const char *kFontStates           = "font-states";
static constexpr const char *kAppliedTheme         = "applied";

static void setIfChanged(SettingsStore &settings, const char *key, nlohmann::json value)
{
    if (settings.set(kStore, key, std::move(value)))
    {
        settings.save();
    }
}

static const char *gestureKey(ToolboxGesture gesture)
{
    return gesture == ToolboxGesture::Shake ? "toolbox.shake" : "toolbox.three-finger";
}

static ToolboxGesture partner(ToolboxGesture gesture)
{
    return gesture == ToolboxGesture::Shake ? ToolboxGesture::ThreeFinger : ToolboxGesture::Shake;
}

bool loaderEnabled(const SettingsStore &settings)
{
    return settings.getBoolean(kStore, kLoaderEnabled, true);
}

bool recoveryEnabled(const SettingsStore &settings)
{
    return settings.getBoolean(kStore, kRecovery, false);
}

bool setRecoveryEnabled(SettingsStore &settings, bool enabled)
{
    settings.set(kStore, kRecovery, enabled);
    settings.set(kStore, kAutomaticRecoveryKey, "");
    return settings.save();
}

std::string automaticRecoveryKey(const SettingsStore &settings)
{
    return settings.getString(kStore, kAutomaticRecoveryKey, "");
}

void setAutomaticRecoveryKey(SettingsStore &settings, const std::string &key)
{
    settings.set(kStore, kAutomaticRecoveryKey, key);
    settings.save();
}

bool developerMode(const SettingsStore &settings)
{
    return settings.getBoolean(kStore, kDeveloperMode, false);
}

bool devOverlayVisible(const SettingsStore &settings, bool virtualDevice, bool debugBuild)
{
    return debugBuild || virtualDevice || developerMode(settings);
}

bool hotReloadEnabled(const SettingsStore &settings)
{
    return settings.getBoolean(kStore, kHotReload, false);
}

bool devtoolsEnabled(const SettingsStore &settings)
{
    return settings.getBoolean(kStore, kDevtools, false);
}

bool telemetryBlocked(const SettingsStore &settings)
{
    return settings.getBoolean(kStore, kBlockTelemetry, true);
}

std::string updateURL(const SettingsStore &settings)
{
    return settings.getString(kStore, kUpdateURL, "");
}

bool forceUpdate(const SettingsStore &settings)
{
    return settings.getBoolean(kStore, kForceUpdate, false);
}

bool setCustomBundle(SettingsStore &settings, const std::string &url)
{
    settings.set(kStore, kUpdateURL, url);
    settings.set(kStore, kForceUpdate, true);
    return settings.save();
}

bool clearCustomBundle(SettingsStore &settings)
{
    settings.set(kStore, kUpdateURL, nullptr);
    settings.set(kStore, kForceUpdate, nullptr);
    return settings.save();
}

bool unsignedBundlesAllowed(const SettingsStore &settings)
{
    return settings.getBoolean(kStore, kUnsignedBundles, false);
}

bool autoClientUpdates(const SettingsStore &settings)
{
    return settings.getBoolean(kStore, kAutoClientUpdate, true);
}

bool updatesWaitForWifi(const SettingsStore &settings)
{
    return settings.getBoolean(kStore, kWaitForWifi, true);
}

std::string bundleEtag(const SettingsStore &settings)
{
    return settings.getString(kStore, kBundleEtag, "");
}

void setBundleEtag(SettingsStore &settings, const std::string &etag)
{
    setIfChanged(settings, kBundleEtag, etag);
}

std::string rejectedRevision(const SettingsStore &settings)
{
    return settings.getString(kStore, kRejectedRevision, "");
}

void setRejectedRevision(SettingsStore &settings, const std::string &revision)
{
    setIfChanged(settings, kRejectedRevision, revision);
}

std::string bundleBaseline(const SettingsStore &settings)
{
    return settings.getString(kStore, kBundleBaseline, "");
}

void setBundleBaseline(SettingsStore &settings, const std::string &record)
{
    setIfChanged(settings, kBundleBaseline, record);
}

std::string checkedByLoader(const SettingsStore &settings)
{
    return settings.getString(kStore, kCheckedByLoader, "");
}

void setCheckedByLoader(SettingsStore &settings, const std::string &version)
{
    setIfChanged(settings, kCheckedByLoader, version);
}

std::optional<std::string> appliedThemeId(const SettingsStore &settings)
{
    const auto value = settings.get(kThemesStore, kAppliedTheme);
    if (!value || !value->is_string() || value->get<std::string>().empty())
    {
        return std::nullopt;
    }
    return value->get<std::string>();
}

std::optional<std::string> activeThemeId(const SettingsStore &settings)
{
    return recoveryEnabled(settings) ? std::nullopt : appliedThemeId(settings);
}

nlohmann::json fontOverrides(const SettingsStore &settings)
{
    const auto value = settings.get(kStore, kFontStates);
    return value && value->is_object() ? *value : nlohmann::json::object();
}

std::optional<ToolboxGesture> gestureNamed(const std::string &name)
{
    for (auto gesture : {ToolboxGesture::Shake, ToolboxGesture::ThreeFinger})
    {
        if (name == gestureName(gesture))
        {
            return gesture;
        }
    }
    return std::nullopt;
}

const char *gestureName(ToolboxGesture gesture)
{
    return gesture == ToolboxGesture::Shake ? "shake" : "three-finger";
}

bool gestureEnabled(const SettingsStore &settings, ToolboxGesture gesture)
{
    return settings.getBoolean(kStore, gestureKey(gesture), true);
}

bool setGestureEnabled(SettingsStore &settings, ToolboxGesture gesture, bool enabled)
{
    settings.set(kStore, gestureKey(gesture), enabled);
    if (!enabled && !gestureEnabled(settings, partner(gesture)))
    {
        settings.set(kStore, gestureKey(partner(gesture)), true);
    }
    return settings.save();
}

std::string recoveryActionLabel(bool enabled)
{
    return enabled ? "Disable Recovery Mode" : "Enable Recovery Mode";
}

std::string recoveryStatusText(bool enabled)
{
    return enabled ? "Recovery Mode enabled" : "Recovery Mode disabled";
}
}
