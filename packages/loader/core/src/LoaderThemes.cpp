#include "LoaderThemes.h"

#include <cctype>

namespace loader {
static const nlohmann::json &emptyObject()
{
    static const nlohmann::json empty = nlohmann::json::object();
    return empty;
}

static const nlohmann::json &bundleSection(const nlohmann::json &theme, const char *name)
{
    if (!theme.is_object() || !theme.contains("bundle") || !theme["bundle"].is_object())
    {
        return emptyObject();
    }

    const nlohmann::json &bundle = theme["bundle"];
    return bundle.contains(name) && bundle[name].is_object() ? bundle[name] : emptyObject();
}

const nlohmann::json *findTheme(const nlohmann::json &themes, const std::string &id)
{
    if (!themes.is_array() || id.empty())
    {
        return nullptr;
    }

    for (const nlohmann::json &theme : themes)
    {
        if (theme.is_object() && theme.contains("manifest") && theme["manifest"].is_object() &&
            theme["manifest"].value("id", std::string()) == id)
        {
            return &theme;
        }
    }
    return nullptr;
}

static std::optional<RGBAColor> colorValue(const nlohmann::json &value)
{
    return value.is_string() ? parseColor(value.get<std::string>()) : std::nullopt;
}

std::string themeColorAccessor(const std::string &key)
{
    if (key.find_first_of("_-.") == std::string::npos &&
        std::any_of(key.begin(), key.end(), [](unsigned char c) {
            return std::islower(c);
        }))
    {
        return key;
    }

    std::string accessor;
    bool        capitalize = false;
    for (unsigned char character : key)
    {
        if (character == '_' || character == '-' || character == '.')
        {
            capitalize = !accessor.empty();
            continue;
        }
        accessor +=
            static_cast<char>(capitalize ? std::toupper(character) : std::tolower(character));
        capitalize = false;
    }
    return accessor;
}

ThemeColors resolveThemeColors(const nlohmann::json &theme)
{
    ThemeColors colors;

    const nlohmann::json &raw = bundleSection(theme, "raw");
    for (auto entry = raw.begin(); entry != raw.end(); ++entry)
    {
        if (auto color = colorValue(entry.value()))
        {
            colors.raw[entry.key()] = *color;
        }
    }

    const nlohmann::json &semantic = bundleSection(theme, "semantic");
    for (auto entry = semantic.begin(); entry != semantic.end(); ++entry)
    {
        if (!entry->is_object())
        {
            continue;
        }

        std::string              type  = entry->value("type", std::string());
        std::string              value = entry->value("value", std::string());
        std::optional<RGBAColor> color;

        if (type == "color")
        {
            color = parseColor(value);
        }
        else if (type == "raw")
        {
            auto themed = colors.raw.find(value);
            if (themed == colors.raw.end())
            {
                if (!value.empty())
                {
                    colors.rawFallbacks[entry.key()] = value;
                }
                continue;
            }
            color = themed->second;
        }

        if (!color)
        {
            continue;
        }

        if (entry->contains("opacity") && (*entry)["opacity"].is_number())
        {
            color->alpha = std::clamp((*entry)["opacity"].get<double>(), 0.0, 1.0);
        }
        colors.semantic[entry.key()] = *color;
    }
    return colors;
}

std::string themeColorResource(const std::string &key)
{
    std::string resource;
    for (unsigned char character : key)
    {
        resource +=
            character == '-' || character == '.' ? '_' : static_cast<char>(std::tolower(character));
    }
    return resource;
}

nlohmann::json themeColorsByAccessor(const ThemeColors &colors)
{
    nlohmann::json semantic     = nlohmann::json::object();
    nlohmann::json raw          = nlohmann::json::object();
    nlohmann::json rawFallbacks = nlohmann::json::object();

    for (const auto &[name, color] : colors.semantic)
    {
        semantic[themeColorAccessor(name)] = toARGB(color);
    }
    for (const auto &[name, color] : colors.raw)
    {
        raw[themeColorResource(name)] = toARGB(color);
    }
    for (const auto &[name, fallback] : colors.rawFallbacks)
    {
        rawFallbacks[themeColorAccessor(name)] = themeColorResource(fallback);
    }

    return {{"semantic", semantic}, {"raw", raw}, {"rawFallbacks", rawFallbacks}};
}

std::optional<std::string> themeIdFrom(const std::string &manifestId)
{
    return manifestId.empty() ? std::nullopt : std::optional<std::string>(manifestId);
}

ThemeSelection::ThemeSelection(InstalledCheck installed) : installed_(std::move(installed)) {}

std::optional<std::string> ThemeSelection::current() const
{
    std::lock_guard<std::mutex> lock(mutex_);
    return current_;
}

std::optional<std::string> ThemeSelection::discordTheme() const
{
    std::lock_guard<std::mutex> lock(mutex_);
    return discordTheme_;
}

std::optional<std::string> ThemeSelection::apply(const std::string &manifestId)
{
    std::lock_guard<std::mutex> lock(mutex_);
    current_ = themeIdFrom(manifestId);
    return current_;
}

bool ThemeSelection::select(const std::string &manifestId)
{
    const std::optional<std::string> themeId = themeIdFrom(manifestId);
    if (themeId && !installed_(*themeId))
    {
        return false;
    }
    std::lock_guard<std::mutex> lock(mutex_);
    customActive_ = themeId.has_value();
    return true;
}

bool ThemeSelection::needsSelection(const std::string &selected) const
{
    std::lock_guard<std::mutex> lock(mutex_);
    return themeIdFrom(selected) != current_;
}

ThemeRefresh ThemeSelection::refresh()
{
    const std::optional<std::string> themeId = current();
    if (!themeId)
    {
        return ThemeRefresh::None;
    }
    if (installed_(*themeId))
    {
        return ThemeRefresh::Reapply;
    }
    std::lock_guard<std::mutex> lock(mutex_);
    customActive_ = false;
    return ThemeRefresh::Reset;
}

std::optional<std::string> ThemeSelection::followDiscordTheme(const std::string &discordTheme)
{
    std::lock_guard<std::mutex> lock(mutex_);
    discordTheme_ = discordTheme;
    if (customActive_ || current_ == discordTheme)
    {
        return std::nullopt;
    }
    return discordTheme;
}
}
