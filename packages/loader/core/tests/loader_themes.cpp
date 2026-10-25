#include <cassert>

#include "LoaderThemes.h"

int main()
{
    nlohmann::json themes = nlohmann::json::parse(R"([
        {"manifest":{"id":"other"},"bundle":{}},
        {"manifest":{"id":"midnight"},"bundle":{
            "raw":{"PRIMARY_100":"#112233","BROKEN":"blue"},
            "semantic":{
                "BACKGROUND":{"type":"color","value":"#000000","opacity":0.5},
                "TEXT":{"type":"raw","value":"PRIMARY_100"},
                "LINK":{"type":"raw","value":"BRAND_500","opacity":0.2},
                "ICON":{"type":"color","value":"nope"},
                "ODD":{"type":"gradient","value":"#ffffff"},
                "BAD":"#ffffff"
            }
        }}
    ])");

    assert(!loader::findTheme(themes, "missing"));
    assert(!loader::findTheme(themes, ""));
    const nlohmann::json *theme = loader::findTheme(themes, "midnight");
    assert(theme);

    loader::ThemeColors colors = loader::resolveThemeColors(*theme);
    assert(colors.raw.size() == 1 && loader::toARGB(colors.raw.at("PRIMARY_100")) == 0xFF112233);
    assert(colors.semantic.size() == 2);
    assert(loader::toARGB(colors.semantic.at("BACKGROUND")) == 0x80000000);
    assert(loader::toARGB(colors.semantic.at("TEXT")) == 0xFF112233);
    assert(colors.rawFallbacks.size() == 1 && colors.rawFallbacks.at("LINK") == "BRAND_500");

    assert(loader::themeColorAccessor("BACKGROUND_BASE_LOWER") == "backgroundBaseLower");
    assert(loader::themeColorAccessor("BRAND_500") == "brand500");
    assert(loader::themeColorAccessor("TEXT_NORMAL") == "textNormal");
    assert(loader::themeColorAccessor("backgroundBaseLower") == "backgroundBaseLower");
    assert(loader::themeColorAccessor("_TEXT__MUTED_") == "textMuted");

    assert(loader::themeColorResource("PRIMARY_100") == "primary_100");
    assert(loader::themeColorResource("brand-500") == "brand_500");

    nlohmann::json byAccessor = loader::themeColorsByAccessor(colors);
    assert(byAccessor["semantic"].size() == 2);
    assert(byAccessor["semantic"]["text"] == 0xFF112233);
    assert(byAccessor["raw"]["primary_100"] == 0xFF112233);
    assert(byAccessor["rawFallbacks"]["link"] == "brand_500");

    loader::ThemeColors empty = loader::resolveThemeColors(nlohmann::json::object());
    assert(empty.semantic.empty() && empty.raw.empty() && empty.rawFallbacks.empty());
    return 0;
}
