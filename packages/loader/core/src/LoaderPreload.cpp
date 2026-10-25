#include "LoaderPreload.h"

#include "LoaderVersion.h"

namespace loader
{
    std::string toJSON(const nlohmann::json &value)
    {
        return value.dump(-1, ' ', false, nlohmann::json::error_handler_t::replace);
    }

    static std::string themesWithSourceBundles(const std::string &themes)
    {
        nlohmann::json parsed = nlohmann::json::parse(themes, nullptr, false);
        if (!parsed.is_array())
        {
            return themes;
        }

        for (nlohmann::json &theme : parsed)
        {
            if (theme.is_object() && theme.contains("bundle") && !theme["bundle"].is_string())
            {
                theme["bundle"] = toJSON(theme["bundle"]);
            }
        }
        return toJSON(parsed);
    }

    std::string buildPreloadScript(const PreloadPayload &payload)
    {
        auto orDefault = [](const std::string &value, const char *fallback) {
            return value.empty() ? std::string(fallback) : value;
        };

        return "this.UNBOUND_SETTINGS = " + orDefault(payload.settings, "{}") + ";\n" +
               "this.UNBOUND_PLUGINS = " + orDefault(payload.plugins, "[]") + ";\n" +
               "this.UNBOUND_THEMES = " + themesWithSourceBundles(orDefault(payload.themes, "[]")) + ";\n" +
               "this.UNBOUND_FONTS = " + orDefault(payload.fonts, "[]") + ";\n" +
               "this.UNBOUND_AVAILABLE_FONTS = " + orDefault(payload.availableFonts, "[]") + ";\n\n" +
               "this.UNBOUND_LOADER = {\n" + "    origin: " + toJSON(payload.origin) + ",\n" +
               "    version: " + toJSON(payload.version) + ",\n" + "};";
    }

    PreloadPayload makePreloadPayload(const SettingsStore &settings, const AddonState &addons,
                                      const nlohmann::json &availableFonts, std::string origin)
    {
        PreloadPayload payload;
        payload.settings       = settings.serialize();
        payload.plugins        = toJSON(addons.plugins());
        payload.themes         = toJSON(addons.themes());
        payload.fonts          = toJSON(addons.fonts());
        payload.availableFonts = toJSON(availableFonts);
        payload.origin         = std::move(origin);
        payload.version        = loaderVersion();
        return payload;
    }
}
