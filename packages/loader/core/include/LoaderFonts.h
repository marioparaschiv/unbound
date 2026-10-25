#pragma once

#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

namespace loader
{
    constexpr const char *kAllFontFamilies = "*";

    std::optional<std::string> fontFullName(const std::string &path);
    std::optional<std::string> fontFullNameFromData(const std::string &data);
    std::optional<std::string> fontOverrideFor(const nlohmann::json &overrides, const std::string &family);

    struct FontTarget
    {
        std::string                name;
        std::optional<std::string> path;
    };

    std::optional<FontTarget> resolveFontTarget(const nlohmann::json &customFonts, const nlohmann::json &systemFonts,
                                                const std::string &name);
    std::string fontUnavailableMessage(const std::string &family, const std::string &name);
    nlohmann::json systemFontsFromFiles(const std::vector<std::string> &paths);
}
