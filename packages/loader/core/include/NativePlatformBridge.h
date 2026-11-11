#pragma once

#include <functional>
#include <jsi/jsi.h>
#include <memory>
#include <nlohmann/json.hpp>
#include <optional>
#include <string>

#include "LoaderSettings.h"

namespace loader {
struct NativePlatformProvider {
    std::string                                 platform;
    std::function<std::string()>                deviceModel;
    std::function<std::string()>                osVersion;
    std::function<bool()>                       isRooted;
    std::function<std::string()>                jailbreak;
    std::function<bool()>                       isSystemApp;
    std::function<bool()>                       isVerifiedBuild;
    std::function<nlohmann::json()>             entitlements;
    std::function<std::string()>                entitlementsAsPlist;
    std::function<std::string()>                appSource;
    std::function<std::string()>                framework;
    std::function<bool()>                       isVirtualDevice;
    std::function<std::optional<std::string>()> virtualDeviceHost;
    // Android's in-app Discord installer: runs `action` with a JSON `argument` and returns JSON, or
    // nullopt on failure.
    std::function<std::optional<std::string>(const std::string &, const std::string &)>
                                    androidInstaller;
    std::string                     documents;
    SettingsStore                  *settings = nullptr;
    std::function<nlohmann::json()> fonts;
};

void setNativePlatformProvider(std::shared_ptr<NativePlatformProvider> provider);
std::shared_ptr<NativePlatformProvider> currentNativePlatformProvider();

nlohmann::json debugEnvironment(const NativePlatformProvider &provider);
nlohmann::json currentDebugEnvironment();

void installNativePlatform(facebook::jsi::Runtime                 &runtime,
                           std::shared_ptr<NativePlatformProvider> provider);
}
