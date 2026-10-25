#pragma once

#include <algorithm>
#include <map>
#include <nlohmann/json.hpp>
#include <string>

#include "LoaderColor.h"

namespace loader {
struct ThemeColors {
    std::map<std::string, RGBAColor>   semantic;
    std::map<std::string, RGBAColor>   raw;
    std::map<std::string, std::string> rawFallbacks;
};

const nlohmann::json *findTheme(const nlohmann::json &themes, const std::string &id);
ThemeColors           resolveThemeColors(const nlohmann::json &theme);
std::string           themeColorAccessor(const std::string &key);
std::string           themeColorResource(const std::string &key);
nlohmann::json        themeColorsByAccessor(const ThemeColors &colors);
}
