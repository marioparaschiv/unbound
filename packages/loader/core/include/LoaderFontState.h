#pragma once

#include <functional>
#include <map>
#include <nlohmann/json.hpp>
#include <optional>
#include <string>
#include <vector>

// The data Unbound's font store keeps in `Unbound/Fonts/state.json`, its JSON shapes, and the pure
// rules over it: which face fills a Discord family, how a group expands, what a preset holds.
namespace loader::fonts {
inline constexpr const char *kLocalProvider = "local";

// Where a face came from: `{ "<provider>": id, "weight"?: n, "style"?: "normal"|"italic" }`, or
// `{ "local": name }` for a font with no source. Presets hold these instead of files.
struct FontSource {
    std::string                provider;
    std::string                id;
    std::optional<int>         weight;
    std::optional<std::string> style;

    bool local() const
    {
        return provider == kLocalProvider;
    }
};

struct InstalledFont {
    std::string id;
    std::string family;
    std::string postScriptName;
    std::string fullName;
    int         weight = 400;
    bool        italic = false;
    // Relative to the Fonts folder.
    std::string file;
    FontSource  source;
};

struct FontPreset {
    std::string                       id;
    std::string                       name;
    std::map<std::string, FontSource> overrides;
};

// One Discord family from `Constants.Fonts`, such as `ggsans-Semibold` in groups `PRIMARY` and
// `DISPLAY`.
struct DiscordFamily {
    std::vector<std::string> groups;
    int                      weight = 400;
    bool                     italic = false;
};

using DiscordFamilies = std::map<std::string, DiscordFamily>;

struct FontState {
    std::vector<InstalledFont>         fonts;
    std::map<std::string, std::string> overrides;
    std::vector<FontPreset>            presets;
};

// A weight from 1 to 1000. JS numbers cross the bridge as doubles, so `400.0` counts.
std::optional<int>        fontWeightOf(const nlohmann::json &value);
std::optional<FontSource> parseFontSource(const nlohmann::json &value);
nlohmann::json            fontSourceJSON(const FontSource &source);
bool                      sameOrigin(const FontSource &left, const FontSource &right);
// The resolver input that names `source` again: a Google family name or the provider's own link.
std::string fontSourceInput(const FontSource &source);

nlohmann::json               installedFontJSON(const InstalledFont &font);
std::optional<InstalledFont> parseInstalledFont(const nlohmann::json &value);
nlohmann::json               fontPresetJSON(const FontPreset &preset);
// Validates a preset from JS or a pasted clipboard; `error` names the first problem.
std::optional<FontPreset> parseFontPreset(const nlohmann::json &value, std::string &error);

FontState      parseFontState(const nlohmann::json &value);
nlohmann::json fontStateJSON(const FontState &state);

// Reads `Constants.Fonts` (`{ PRIMARY_SEMIBOLD: "ggsans-Semibold", ... }`) into its families.
DiscordFamilies discordFamilies(const nlohmann::json &constants);
// The weight and style a family asks for, from `families` or else its own name.
DiscordFamily discordFamily(const DiscordFamilies &families, const std::string &family);

// A store id for a face: its PostScript name with only `[A-Za-z0-9._-]`, at most 128 characters.
std::string fontIdFor(const std::string &postScriptName);

const InstalledFont *findFont(const std::vector<InstalledFont> &fonts, const std::string &id);
// The face closest to `weight` and `italic` among `fonts` that `accept` lets through.
const InstalledFont *nearestFace(const std::vector<InstalledFont> &fonts, int weight, bool italic,
                                 const std::function<bool(const InstalledFont &)> &accept);
// The installed face a preset's `source` names for `family`, if any.
const InstalledFont *matchSource(const std::vector<InstalledFont> &fonts, const FontSource &source,
                                 const DiscordFamily &family);

// The overrides after pointing `key` at `fontId`, or clearing it when `fontId` is empty. A group
// key such as `PRIMARY` sets every family of the group to the face of the same family closest in
// weight and style. Returns `std::nullopt` for an unknown font id.
std::optional<std::map<std::string, std::string>>
withOverride(const FontState &state, const DiscordFamilies &families, const std::string &key,
             const std::optional<std::string> &fontId);
}
