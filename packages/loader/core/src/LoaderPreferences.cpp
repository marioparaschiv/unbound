#include "LoaderPreferences.h"

#include <cstdio>

#include "LoaderFonts.h"

namespace loader::preferences {
static constexpr const char *kRecovery       = "recovery";
static constexpr const char *kDeveloperMode  = "developer-mode";
static constexpr const char *kHotReload      = "loader.update.hmr";
static constexpr const char *kLoaderEnabled  = "loader.enabled";
static constexpr const char *kFontStates     = "font-states";
static constexpr const char *kAppliedTheme   = "applied";
static constexpr const char *kMessageBubbles = "chat.message-bubbles";
static constexpr const char *kAvatarRadius   = "chat.avatar-radius";

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
    return settings.save();
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

RGBAColor messageBubbleColor(bool dark)
{
    return parseColor(dark ? kMessageBubbleStyle.darkColor : kMessageBubbleStyle.lightColor)
        .value_or(RGBAColor{});
}

bool messageBubbles(const SettingsStore &settings)
{
    return settings.getBoolean(kStore, kMessageBubbles, false);
}

bool setMessageBubbles(SettingsStore &settings, bool enabled)
{
    settings.set(kStore, kMessageBubbles, enabled);
    return settings.save();
}

std::optional<double> avatarRadius(const SettingsStore &settings)
{
    const auto value = settings.get(kStore, kAvatarRadius);
    if (!value || !value->is_number() || value->get<double>() < 0)
    {
        return std::nullopt;
    }
    return value->get<double>();
}

std::string recoveryActionLabel(bool enabled)
{
    return enabled ? "Disable Recovery Mode" : "Enable Recovery Mode";
}

std::string recoveryStatusText(bool enabled)
{
    return enabled ? "Recovery Mode enabled" : "Recovery Mode disabled";
}

static std::string flag(bool value)
{
    return value ? "true" : "false";
}

static std::string radiusText(std::optional<double> radius)
{
    if (!radius)
    {
        return "";
    }
    char text[32];
    std::snprintf(text, sizeof(text), "%g", *radius);
    return text;
}

std::string perform(SettingsStore &settings, const std::string &action, const std::string &argument)
{
    if (action == "loader-enabled")
    {
        return flag(loaderEnabled(settings));
    }
    if (action == "recovery")
    {
        return flag(recoveryEnabled(settings));
    }
    if (action == "recovery-label")
    {
        return recoveryActionLabel(recoveryEnabled(settings));
    }
    if (action == "recovery-status")
    {
        return recoveryStatusText(recoveryEnabled(settings));
    }
    if (action == "dev-overlay")
    {
        return flag(devOverlayVisible(settings,
                                      argument.find("virtual-device") != std::string::npos,
                                      argument.find("debug-build") != std::string::npos));
    }
    if (action == "developer-mode")
    {
        return flag(developerMode(settings));
    }
    if (action == "hot-reload")
    {
        return flag(hotReloadEnabled(settings));
    }
    if (action == "active-theme")
    {
        return activeThemeId(settings).value_or("");
    }
    if (action == "applied-theme")
    {
        return appliedThemeId(settings).value_or("");
    }
    if (action == "font-overrides")
    {
        return fontOverrides(settings).dump();
    }
    if (action == "font-override")
    {
        return fontOverrideFor(fontOverrides(settings), argument).value_or("");
    }
    if (action == "gesture" || action == "set-gesture")
    {
        const auto separator = argument.find('=');
        const auto gesture   = gestureNamed(argument.substr(0, separator));
        if (!gesture)
        {
            return "";
        }
        if (action == "set-gesture" && separator != std::string::npos)
        {
            setGestureEnabled(settings, *gesture, argument.substr(separator + 1) == "true");
        }
        return flag(gestureEnabled(settings, *gesture));
    }
    if (action == "message-bubbles")
    {
        return flag(messageBubbles(settings));
    }
    if (action == "avatar-radius")
    {
        return radiusText(avatarRadius(settings));
    }
    return "";
}
}
