#include "LoaderThemes.h"

namespace loader
{
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

            std::string type  = entry->value("type", std::string());
            std::string value = entry->value("value", std::string());
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
}
