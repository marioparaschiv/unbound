#pragma once

#include <functional>
#include <mutex>
#include <nlohmann/json.hpp>
#include <optional>
#include <string>

namespace loader {
nlohmann::json scanPlugins(const std::string &documents);
nlohmann::json scanThemes(const std::string &documents);
nlohmann::json scanFonts(const std::string &documents);

class AddonState
{
public:
    void scan(const std::string &documents);

    nlohmann::json                plugins() const;
    nlohmann::json                themes() const;
    nlohmann::json                fonts() const;
    std::optional<nlohmann::json> theme(const std::string &id) const;

private:
    mutable std::mutex mutex_;
    nlohmann::json     plugins_ = nlohmann::json::array();
    nlohmann::json     themes_  = nlohmann::json::array();
    nlohmann::json     fonts_   = nlohmann::json::array();
};
}
