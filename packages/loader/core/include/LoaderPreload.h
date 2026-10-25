#pragma once

#include <string>

#include <nlohmann/json.hpp>

#include "LoaderAddons.h"
#include "LoaderSettings.h"

namespace loader
{
    struct PreloadPayload
    {
        std::string settings       = "{}";
        std::string plugins        = "[]";
        std::string themes         = "[]";
        std::string fonts          = "[]";
        std::string availableFonts = "[]";
        std::string origin;
        std::string version;
    };

    std::string toJSON(const nlohmann::json &value);
    std::string buildPreloadScript(const PreloadPayload &payload);
    PreloadPayload makePreloadPayload(const SettingsStore &settings, const AddonState &addons,
                                      const nlohmann::json &availableFonts, std::string origin);
}
