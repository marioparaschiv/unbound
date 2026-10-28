#pragma once

#include <cstdint>
#include <nlohmann/json.hpp>
#include <string>

#include "LoaderAddons.h"
#include "LoaderSettings.h"

namespace loader {
struct PreloadPayload {
    nlohmann::json settings       = nlohmann::json::object();
    nlohmann::json plugins        = nlohmann::json::array();
    nlohmann::json themes         = nlohmann::json::array();
    nlohmann::json fonts          = nlohmann::json::array();
    nlohmann::json availableFonts = nlohmann::json::array();
    std::string    origin;
    std::string    version;
    uint32_t       bytecodeVersion = 0;
};

std::string    toJSON(const nlohmann::json &value);
nlohmann::json preloadData(const PreloadPayload &payload);
PreloadPayload makePreloadPayload(const SettingsStore &settings, const AddonState &addons,
                                  const nlohmann::json &availableFonts, std::string origin,
                                  uint32_t bytecodeVersion);
}
