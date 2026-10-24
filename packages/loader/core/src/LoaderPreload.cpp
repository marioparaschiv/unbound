#include "LoaderPreload.h"

namespace loader
{
    std::string toJSON(const nlohmann::json &value)
    {
        return value.dump(-1, ' ', false, nlohmann::json::error_handler_t::replace);
    }

    std::string buildPreloadScript(const PreloadPayload &payload)
    {
        auto orDefault = [](const std::string &value, const char *fallback) {
            return value.empty() ? std::string(fallback) : value;
        };

        return "this.UNBOUND_SETTINGS = " + orDefault(payload.settings, "{}") + ";\n" +
               "this.UNBOUND_PLUGINS = " + orDefault(payload.plugins, "[]") + ";\n" +
               "this.UNBOUND_THEMES = " + orDefault(payload.themes, "[]") + ";\n" +
               "this.UNBOUND_FONTS = " + orDefault(payload.fonts, "[]") + ";\n" +
               "this.UNBOUND_AVAILABLE_FONTS = " + orDefault(payload.availableFonts, "[]") + ";\n\n" +
               "this.UNBOUND_LOADER = {\n" + "    origin: " + toJSON(payload.origin) + ",\n" +
               "    version: " + toJSON(payload.version) + ",\n" + "};";
    }
}
