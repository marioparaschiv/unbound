#pragma once

#include <optional>
#include <string>

#include <nlohmann/json.hpp>

namespace loader
{
    constexpr const char *kAllFontFamilies = "*";

    std::optional<std::string> fontFullName(const std::string &path);
    std::optional<std::string> fontFullNameFromData(const std::string &data);
    std::optional<std::string> fontOverrideFor(const nlohmann::json &overrides, const std::string &family);
}
