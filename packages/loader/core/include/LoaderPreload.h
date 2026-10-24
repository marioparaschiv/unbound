#pragma once

#include <string>

#include <nlohmann/json.hpp>

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
}
