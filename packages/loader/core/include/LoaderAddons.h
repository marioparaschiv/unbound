#pragma once

#include <functional>
#include <string>

#include <nlohmann/json.hpp>

namespace loader
{
    using FontNameResolver = std::function<std::string(const std::string &path)>;

    nlohmann::json scanPlugins(const std::string &documents);
    nlohmann::json scanThemes(const std::string &documents);
    nlohmann::json scanFonts(const std::string &documents, const FontNameResolver &resolveName);
}
