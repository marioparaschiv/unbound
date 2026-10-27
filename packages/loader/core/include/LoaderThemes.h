#pragma once

#include <algorithm>
#include <functional>
#include <map>
#include <mutex>
#include <nlohmann/json.hpp>
#include <optional>
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

std::optional<std::string> themeIdFrom(const std::string &manifestId);

enum class ThemeRefresh
{
    None,
    Reset,
    Reapply,
};

class ThemeSelection
{
public:
    using InstalledCheck = std::function<bool(const std::string &)>;

    explicit ThemeSelection(InstalledCheck installed);

    std::optional<std::string> current() const;
    std::optional<std::string> discordTheme() const;
    std::optional<std::string> apply(const std::string &manifestId);
    bool                       select(const std::string &manifestId);
    bool                       needsSelection(const std::string &selected) const;
    ThemeRefresh               refresh();
    std::optional<std::string> followDiscordTheme(const std::string &discordTheme);

private:
    InstalledCheck             installed_;
    std::optional<std::string> current_;
    std::optional<std::string> discordTheme_;
    bool                       customActive_ = false;
    mutable std::mutex         mutex_;
};
}
