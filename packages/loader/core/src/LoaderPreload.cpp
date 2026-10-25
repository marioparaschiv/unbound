#include "LoaderPreload.h"

#include "LoaderVersion.h"

namespace loader
{
    std::string toJSON(const nlohmann::json &value)
    {
        return value.dump(-1, ' ', false, nlohmann::json::error_handler_t::replace);
    }

    static nlohmann::json themesWithSourceBundles(nlohmann::json themes)
    {
        if (!themes.is_array())
        {
            return nlohmann::json::array();
        }

        for (nlohmann::json &theme : themes)
        {
            if (theme.is_object() && theme.contains("bundle") && !theme["bundle"].is_string())
            {
                theme["bundle"] = toJSON(theme["bundle"]);
            }
        }
        return themes;
    }

    nlohmann::json preloadData(const PreloadPayload &payload)
    {
        return {{"settings", payload.settings.is_object() ? payload.settings : nlohmann::json::object()},
                {"plugins", payload.plugins.is_array() ? payload.plugins : nlohmann::json::array()},
                {"themes", themesWithSourceBundles(payload.themes)},
                {"fonts", payload.fonts.is_array() ? payload.fonts : nlohmann::json::array()},
                {"availableFonts", payload.availableFonts.is_array() ? payload.availableFonts : nlohmann::json::array()},
                {"loader", {{"origin", payload.origin}, {"version", payload.version}}}};
    }

    PreloadPayload makePreloadPayload(const SettingsStore &settings, const AddonState &addons,
                                      const nlohmann::json &availableFonts, std::string origin)
    {
        PreloadPayload payload;
        payload.settings       = settings.snapshot();
        payload.plugins        = addons.plugins();
        payload.themes         = addons.themes();
        payload.fonts          = addons.fonts();
        payload.availableFonts = availableFonts;
        payload.origin         = std::move(origin);
        payload.version        = loaderVersion();
        return payload;
    }
}
