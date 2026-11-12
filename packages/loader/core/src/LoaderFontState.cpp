#include "LoaderFontState.h"

#include <algorithm>
#include <array>
#include <cctype>
#include <cstdlib>
#include <functional>

#include "LoaderFontVariations.h"

namespace loader::fonts {
static constexpr size_t kMaximumSourceId    = 2048;
static constexpr size_t kMaximumPresetName  = 64;
static constexpr size_t kMaximumFamilyName  = 128;
static constexpr size_t kMaximumOverrides   = 256;
static constexpr size_t kMaximumFontIdBytes = 128;

static constexpr std::array<const char *, 8> kProviders = {
    "google", "fontsource", "fontshare", "fontsquirrel", "dafont", "github", "url", kLocalProvider};

static bool isLinkProvider(const std::string &provider)
{
    return provider == "github" || provider == "url";
}

static bool hasControlCharacter(const std::string &text)
{
    return std::any_of(text.begin(), text.end(), [](unsigned char character) {
        return character < 0x20 || character == 0x7F;
    });
}

static std::optional<std::string> styleOf(const nlohmann::json &value)
{
    if (value.is_string() && (value == "normal" || value == "italic"))
    {
        return value.get<std::string>();
    }
    return std::nullopt;
}

std::optional<int> fontWeightOf(const nlohmann::json &value)
{
    if (!value.is_number())
    {
        return std::nullopt;
    }
    const double weight = value.get<double>();
    if (!(weight >= 1 && weight <= 1000) || weight != static_cast<int>(weight))
    {
        return std::nullopt;
    }
    return static_cast<int>(weight);
}

std::optional<FontSource> parseFontSource(const nlohmann::json &value)
{
    if (!value.is_object())
    {
        return std::nullopt;
    }
    std::optional<FontSource> source;
    for (const char *provider : kProviders)
    {
        const auto found = value.find(provider);
        if (found == value.end())
        {
            continue;
        }
        if (source || !found->is_string())
        {
            return std::nullopt;
        }
        source = FontSource{provider, found->get<std::string>(), std::nullopt, std::nullopt};
    }
    if (!source || source->id.empty() || source->id.size() > kMaximumSourceId ||
        hasControlCharacter(source->id) ||
        (isLinkProvider(source->provider) && !source->id.starts_with("https://")))
    {
        return std::nullopt;
    }
    if (const auto weight = value.find("weight"); weight != value.end() && !weight->is_null())
    {
        source->weight = fontWeightOf(*weight);
        if (!source->weight)
        {
            return std::nullopt;
        }
    }
    if (const auto style = value.find("style"); style != value.end() && !style->is_null())
    {
        source->style = styleOf(*style);
        if (!source->style)
        {
            return std::nullopt;
        }
    }
    return source;
}

nlohmann::json fontSourceJSON(const FontSource &source)
{
    nlohmann::json json = {{source.provider, source.id}};
    if (source.weight)
    {
        json["weight"] = *source.weight;
    }
    if (source.style)
    {
        json["style"] = *source.style;
    }
    return json;
}

bool sameOrigin(const FontSource &left, const FontSource &right)
{
    return left.provider == right.provider && left.id == right.id;
}

std::string fontSourceInput(const FontSource &source)
{
    if (source.provider == "fontsource")
    {
        return "https://fontsource.org/fonts/" + source.id;
    }
    if (source.provider == "fontshare")
    {
        return "https://www.fontshare.com/fonts/" + source.id;
    }
    if (source.provider == "fontsquirrel")
    {
        return "https://www.fontsquirrel.com/fonts/" + source.id;
    }
    if (source.provider == "dafont")
    {
        return "https://www.dafont.com/" + source.id + ".font";
    }
    return source.id;
}

nlohmann::json installedFontJSON(const InstalledFont &font)
{
    nlohmann::json json = {{"id", font.id},
                           {"family", font.family},
                           {"postScriptName", font.postScriptName},
                           {"fullName", font.fullName},
                           {"weight", font.weight},
                           {"style", font.italic ? "italic" : "normal"},
                           {"file", font.file},
                           {"source", fontSourceJSON(font.source)}};
    if (!font.axes.empty())
    {
        nlohmann::json axes = nlohmann::json::array();
        for (const FontAxis &axis : font.axes)
        {
            axes.push_back({{"tag", axis.tag},
                            {"name", axis.name},
                            {"min", axis.minimum},
                            {"default", axis.defaultValue},
                            {"max", axis.maximum},
                            {"hidden", axis.hidden}});
        }
        json["axes"]       = std::move(axes);
        json["variations"] = font.variations;
    }
    return json;
}

static std::string stringField(const nlohmann::json &value, const char *key)
{
    const auto found = value.find(key);
    return found != value.end() && found->is_string() ? found->get<std::string>() : "";
}

static std::optional<double> numberField(const nlohmann::json &value, const char *key)
{
    const auto found = value.find(key);
    return found != value.end() && found->is_number() ? std::optional(found->get<double>())
                                                      : std::nullopt;
}

// The axes of a stored face, or `std::nullopt` for a malformed one.
static std::optional<std::vector<FontAxis>> parseAxes(const nlohmann::json &value)
{
    std::vector<FontAxis> axes;
    for (const nlohmann::json &axis : value.is_array() ? value : nlohmann::json::array())
    {
        const auto minimum = axis.is_object() ? numberField(axis, "min") : std::nullopt;
        const auto initial = axis.is_object() ? numberField(axis, "default") : std::nullopt;
        const auto maximum = axis.is_object() ? numberField(axis, "max") : std::nullopt;
        const auto tag     = axis.is_object() ? stringField(axis, "tag") : "";
        if (tag.empty() || tag.size() > 4 || !minimum || !initial || !maximum ||
            !(*minimum <= *initial && *initial <= *maximum))
        {
            return std::nullopt;
        }
        axes.push_back({tag, stringField(axis, "name"), *minimum, *initial, *maximum,
                        axis.value("hidden", false) == true});
    }
    return axes;
}

std::optional<InstalledFont> parseInstalledFont(const nlohmann::json &value)
{
    if (!value.is_object())
    {
        return std::nullopt;
    }
    InstalledFont font;
    font.id             = stringField(value, "id");
    font.family         = stringField(value, "family");
    font.postScriptName = stringField(value, "postScriptName");
    font.fullName       = stringField(value, "fullName");
    font.file           = stringField(value, "file");
    font.italic         = stringField(value, "style") == "italic";
    const auto weight   = value.find("weight");
    font.weight = weight != value.end() && weight->is_number_integer() ? weight->get<int>() : 400;
    const auto source = value.find("source");
    const auto parsed = source != value.end() ? parseFontSource(*source) : std::nullopt;
    const auto axes   = parseAxes(value.value("axes", nlohmann::json::array()));
    if (font.id.empty() || font.postScriptName.empty() || font.file.empty() || !parsed || !axes)
    {
        return std::nullopt;
    }
    font.source = *parsed;
    font.axes   = *axes;
    std::string          error;
    const nlohmann::json variations = value.value("variations", nlohmann::json::object());
    for (const auto &[tag, coordinate] : variations.items())
    {
        if (coordinate.is_number())
        {
            font.variations[tag] = coordinate.get<double>();
        }
    }
    // Coordinates past an axis clamp to it; a face naming an axis the font lacks draws at the
    // defaults.
    auto coordinates = instanceCoordinates(font.axes, font.variations, error);
    coordinates      = coordinates ? coordinates : instanceCoordinates(font.axes, {}, error);
    font.variations  = font.axes.empty() ? FontVariations{} : *coordinates;
    return font;
}

nlohmann::json fontPresetJSON(const FontPreset &preset)
{
    nlohmann::json overrides = nlohmann::json::object();
    for (const auto &[family, source] : preset.overrides)
    {
        overrides[family] = fontSourceJSON(source);
    }
    return {{"id", preset.id}, {"name", preset.name}, {"overrides", std::move(overrides)}};
}

static std::string trimmed(const std::string &text)
{
    const size_t first = text.find_first_not_of(" \t\r\n");
    const size_t last  = text.find_last_not_of(" \t\r\n");
    return first == std::string::npos ? "" : text.substr(first, last - first + 1);
}

std::optional<FontPreset> parseFontPreset(const nlohmann::json &value, std::string &error)
{
    if (!value.is_object())
    {
        error = "A preset must be an object";
        return std::nullopt;
    }
    FontPreset preset;
    preset.id   = stringField(value, "id");
    preset.name = trimmed(stringField(value, "name"));
    if (preset.name.empty() || preset.name.size() > kMaximumPresetName ||
        hasControlCharacter(preset.name))
    {
        error = "A preset needs a name of at most 64 characters";
        return std::nullopt;
    }
    const auto overrides = value.find("overrides");
    if (overrides == value.end() || !overrides->is_object() ||
        overrides->size() > kMaximumOverrides)
    {
        error = "A preset needs an overrides object";
        return std::nullopt;
    }
    for (const auto &[family, source] : overrides->items())
    {
        const auto parsed = parseFontSource(source);
        if (family.empty() || family.size() > kMaximumFamilyName || hasControlCharacter(family) ||
            !parsed)
        {
            error = "The preset's font for \"" + family.substr(0, kMaximumFamilyName) +
                    "\" is not valid";
            return std::nullopt;
        }
        preset.overrides[family] = *parsed;
    }
    return preset;
}

FontState parseFontState(const nlohmann::json &value)
{
    FontState state;
    if (!value.is_object())
    {
        return state;
    }
    for (const nlohmann::json &font : value.value("fonts", nlohmann::json::array()))
    {
        if (auto parsed = parseInstalledFont(font); parsed && !findFont(state.fonts, parsed->id))
        {
            state.fonts.push_back(std::move(*parsed));
        }
    }
    const nlohmann::json overrides = value.value("overrides", nlohmann::json::object());
    for (const auto &[family, id] : overrides.items())
    {
        if (id.is_string() && findFont(state.fonts, id.get<std::string>()))
        {
            state.overrides[family] = id.get<std::string>();
        }
    }
    for (const nlohmann::json &preset : value.value("presets", nlohmann::json::array()))
    {
        std::string error;
        if (auto parsed = parseFontPreset(preset, error); parsed && !parsed->id.empty())
        {
            state.presets.push_back(std::move(*parsed));
        }
    }
    return state;
}

nlohmann::json fontStateJSON(const FontState &state)
{
    nlohmann::json fonts   = nlohmann::json::array();
    nlohmann::json presets = nlohmann::json::array();
    for (const InstalledFont &font : state.fonts)
    {
        fonts.push_back(installedFontJSON(font));
    }
    for (const FontPreset &preset : state.presets)
    {
        presets.push_back(fontPresetJSON(preset));
    }
    return {{"version", 1},
            {"fonts", std::move(fonts)},
            {"overrides", state.overrides},
            {"presets", std::move(presets)}};
}

static std::string lowercase(std::string text)
{
    std::transform(text.begin(), text.end(), text.begin(), [](unsigned char character) {
        return static_cast<char>(std::tolower(character));
    });
    return text;
}

// Longer names first, so `semibold` wins over `bold`.
static std::optional<int> weightNamed(const std::string &text)
{
    static const std::array<std::pair<const char *, int>, 16> kWeights = {{{"extrabold", 800},
                                                                           {"extra_bold", 800},
                                                                           {"ultrabold", 800},
                                                                           {"semibold", 600},
                                                                           {"semi_bold", 600},
                                                                           {"demibold", 600},
                                                                           {"extralight", 200},
                                                                           {"ultralight", 200},
                                                                           {"black", 900},
                                                                           {"heavy", 900},
                                                                           {"bold", 700},
                                                                           {"medium", 500},
                                                                           {"light", 300},
                                                                           {"thin", 100},
                                                                           {"normal", 400},
                                                                           {"regular", 400}}};
    const std::string                                         lower    = lowercase(text);
    for (const auto &[name, weight] : kWeights)
    {
        if (lower.find(name) != std::string::npos)
        {
            return weight;
        }
    }
    return std::nullopt;
}

static bool italicNamed(const std::string &text)
{
    const std::string lower = lowercase(text);
    return lower.find("italic") != std::string::npos || lower.find("oblique") != std::string::npos;
}

DiscordFamilies discordFamilies(const nlohmann::json &constants)
{
    DiscordFamilies families;
    if (!constants.is_object())
    {
        return families;
    }
    for (const auto &[key, value] : constants.items())
    {
        if (!value.is_string() || key.empty())
        {
            continue;
        }
        const std::string group = key.substr(0, key.find('_'));
        const std::string list  = value.get<std::string>();
        size_t            start = 0;
        while (start <= list.size())
        {
            const size_t      end    = std::min(list.find(',', start), list.size());
            const std::string family = trimmed(list.substr(start, end - start));
            start                    = end + 1;
            if (family.empty() || family.size() > kMaximumFamilyName)
            {
                continue;
            }
            // Discord lists one family under several groups, such as ggsans-Bold in PRIMARY and
            // DISPLAY.
            if (const auto known = families.find(family); known != families.end())
            {
                auto &groups = known->second.groups;
                if (std::find(groups.begin(), groups.end(), group) == groups.end())
                {
                    groups.push_back(group);
                }
                continue;
            }
            const auto weight = weightNamed(key);
            families[family]  = {{group},
                                 weight.value_or(weightNamed(family).value_or(400)),
                                 italicNamed(key) || italicNamed(family)};
        }
    }
    return families;
}

DiscordFamily discordFamily(const DiscordFamilies &families, const std::string &family)
{
    const auto found = families.find(family);
    if (found != families.end())
    {
        return found->second;
    }
    return {{}, weightNamed(family).value_or(400), italicNamed(family)};
}

std::string fontIdFor(const std::string &postScriptName)
{
    std::string id;
    for (unsigned char character : postScriptName)
    {
        if (id.size() == kMaximumFontIdBytes)
        {
            break;
        }
        const bool safe =
            std::isalnum(character) || character == '.' || character == '_' || character == '-';
        id += safe ? static_cast<char>(character) : '-';
    }
    if (id.empty() || id.front() == '.')
    {
        id.insert(id.begin(), 'f');
    }
    return id.substr(0, kMaximumFontIdBytes);
}

const InstalledFont *findFont(const std::vector<InstalledFont> &fonts, const std::string &id)
{
    const auto found = std::find_if(fonts.begin(), fonts.end(), [&](const InstalledFont &font) {
        return font.id == id;
    });
    return found == fonts.end() ? nullptr : &*found;
}

const InstalledFont *nearestFace(const std::vector<InstalledFont> &fonts, int weight, bool italic,
                                 const std::function<bool(const InstalledFont &)> &accept)
{
    const InstalledFont *best      = nullptr;
    int                  bestScore = 0;
    for (const InstalledFont &font : fonts)
    {
        if (!accept(font))
        {
            continue;
        }
        // A style mismatch costs more than any weight gap.
        const int score = std::abs(font.weight - weight) + (font.italic == italic ? 0 : 2000);
        if (!best || score < bestScore)
        {
            best      = &font;
            bestScore = score;
        }
    }
    return best;
}

const InstalledFont *matchSource(const std::vector<InstalledFont> &fonts, const FontSource &source,
                                 const DiscordFamily &family)
{
    const int  weight = source.weight.value_or(family.weight);
    const bool italic = source.style ? *source.style == "italic" : family.italic;
    const auto face   = nearestFace(fonts, weight, italic, [&](const InstalledFont &font) {
        return sameOrigin(font.source, source);
    });
    const bool exact  = face && face->weight == weight && face->italic == italic;
    // A pinned weight or style means that face exactly; an unpinned one takes the closest face.
    return face && (exact || (!source.weight && !source.style)) ? face : nullptr;
}

std::optional<std::map<std::string, std::string>>
withOverride(const FontState &state, const DiscordFamilies &families, const std::string &key,
             const std::optional<std::string> &fontId)
{
    const InstalledFont *chosen = fontId ? findFont(state.fonts, *fontId) : nullptr;
    if (fontId && !chosen)
    {
        return std::nullopt;
    }

    std::vector<std::string> members;
    for (const auto &[family, discord] : families)
    {
        if (std::find(discord.groups.begin(), discord.groups.end(), key) != discord.groups.end())
        {
            members.push_back(family);
        }
    }

    std::map<std::string, std::string> overrides = state.overrides;
    if (members.empty())
    {
        if (chosen)
        {
            overrides[key] = chosen->id;
        }
        else
        {
            overrides.erase(key);
        }
        return overrides;
    }

    for (const std::string &family : members)
    {
        if (!chosen)
        {
            overrides.erase(family);
            continue;
        }
        const DiscordFamily  wanted = discordFamily(families, family);
        const InstalledFont *face =
            nearestFace(state.fonts, wanted.weight, wanted.italic, [&](const InstalledFont &font) {
                return font.family == chosen->family;
            });
        overrides[family] = face ? face->id : chosen->id;
    }
    return overrides;
}
}
