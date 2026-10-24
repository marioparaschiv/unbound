#pragma once

#include <algorithm>
#include <map>
#include <string>

#include <nlohmann/json.hpp>

#include "LoaderColor.h"

namespace loader
{
    struct ThemeColors
    {
        std::map<std::string, RGBAColor>   semantic;
        std::map<std::string, RGBAColor>   raw;
        std::map<std::string, std::string> rawFallbacks;
    };

    const nlohmann::json *findTheme(const nlohmann::json &themes, const std::string &id);
    ThemeColors resolveThemeColors(const nlohmann::json &theme);
}
