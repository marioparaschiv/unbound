#include "LoaderFontService.h"

#include <cctype>
#include <set>
#include <stdexcept>
#include <tuple>

#include "LoaderFiles.h"
#include "LoaderFontFiles.h"
#include "LoaderJSON.h"
#include "LoaderLog.h"

#ifndef UNBOUND_DEFAULT_API_URL
#define UNBOUND_DEFAULT_API_URL "https://unbound.rip"
#endif

namespace loader::fonts {
// A resolver answer is small; a font or archive gets the time a slow connection needs for 10 MB.
static constexpr DownloadPolicy kResolvePolicy{10.0, 15.0, 20.0};
static constexpr DownloadPolicy kFontPolicy{15.0, 30.0, 120.0};
static constexpr size_t         kMaximumResolvedFiles = 64;

std::string defaultApiOrigin()
{
    return UNBOUND_DEFAULT_API_URL;
}

std::string percentEncode(const std::string &text)
{
    static constexpr const char *kHex = "0123456789ABCDEF";
    std::string                  encoded;
    for (unsigned char character : text)
    {
        if (std::isalnum(character) || character == '-' || character == '_' || character == '.' ||
            character == '~')
        {
            encoded += static_cast<char>(character);
            continue;
        }
        encoded += '%';
        encoded += kHex[character >> 4];
        encoded += kHex[character & 0xF];
    }
    return encoded;
}

FontService::FontService(std::string documents, FileDownloader download)
    : store_(std::move(documents)), download_(std::move(download)), apiOrigin_(defaultApiOrigin())
{
}

FontStore &FontService::store()
{
    return store_;
}

void FontService::setApiOrigin(std::string origin)
{
    while (!origin.empty() && origin.back() == '/')
    {
        origin.pop_back();
    }
    if (!origin.starts_with("https://") && !origin.starts_with("http://"))
    {
        return;
    }
    std::lock_guard<std::mutex> lock(apiMutex_);
    apiOrigin_ = std::move(origin);
}

nlohmann::json FontService::list() const
{
    const FontState state    = store_.state();
    nlohmann::json  fonts    = nlohmann::json::array();
    nlohmann::json  families = nlohmann::json::object();
    for (const InstalledFont &font : state.fonts)
    {
        nlohmann::json entry = installedFontJSON(font);
        entry["path"]        = store_.pathOf(font);
        fonts.push_back(std::move(entry));
    }
    for (const auto &[family, discord] : store_.families())
    {
        families[family] = {{"groups", discord.groups},
                            {"weight", discord.weight},
                            {"style", discord.italic ? "italic" : "normal"}};
    }
    return {{"fonts", std::move(fonts)},
            {"overrides", state.overrides},
            {"families", std::move(families)}};
}

nlohmann::json FontService::catalogEntries() const
{
    nlohmann::json entries = nlohmann::json::array();
    for (const InstalledFont &font : store_.state().fonts)
    {
        entries.push_back({{"name", font.postScriptName},
                           {"displayName", font.fullName},
                           {"family", font.family},
                           {"path", store_.pathOf(font)},
                           {"source", "custom"}});
    }
    return entries;
}

static std::string resolveFailure(int status)
{
    switch (status)
    {
        case 400:
            return "That is not a font name or a link Unbound can read";
        case 404:
            return "No font was found for that name or link";
        case 429:
            return "Too many font lookups; try again in a minute";
        case 502:
            return "The font's provider did not answer; try again later";
        default:
            return "Unbound's font lookup failed with HTTP " + std::to_string(status);
    }
}

static bool isProvider(const nlohmann::json &provider)
{
    return provider.is_string() && provider != kLocalProvider &&
           parseFontSource({{provider.get<std::string>(), "https://x"}}).has_value();
}

// Checks the resolver's answer has the shape `@unbound-app/contracts/fonts` promises.
static nlohmann::json checkedResolution(const nlohmann::json &value)
{
    const auto text = [&](const char *key) {
        return value.contains(key) && value[key].is_string() &&
               !value[key].get<std::string>().empty();
    };
    if (!value.is_object() || !isProvider(value.value("provider", nlohmann::json())) ||
        !text("id") || !text("family") || !value.contains("files") || !value["files"].is_array() ||
        value["files"].empty() || value["files"].size() > kMaximumResolvedFiles)
    {
        throw std::runtime_error("Unbound's font lookup answered with something unreadable");
    }
    for (const nlohmann::json &file : value["files"])
    {
        const auto url    = file.value("url", nlohmann::json());
        const auto kind   = file.value("kind", nlohmann::json());
        const auto weight = file.value("weight", nlohmann::json());
        const auto style  = file.value("style", nlohmann::json());
        if (!url.is_string() || !url.get<std::string>().starts_with("https://") ||
            (kind != "font" && kind != "archive") ||
            !(weight.is_null() || (weight.is_number_integer() && weight >= 1 && weight <= 1000)) ||
            !(style.is_null() || style == "normal" || style == "italic"))
        {
            throw std::runtime_error("Unbound's font lookup listed an unreadable file");
        }
    }
    return value;
}

nlohmann::json FontService::resolveLocked(const std::string &input)
{
    std::string origin;
    {
        std::lock_guard<std::mutex> lock(apiMutex_);
        origin = apiOrigin_;
    }
    const std::string staged = store_.stagingDirectory();
    const std::string target = joinPath(staged, "resolved.json");
    const auto result = download_(origin + "/api/v1/fonts/resolve?input=" + percentEncode(input),
                                  target, {{"accept", "application/json"}}, kResolvePolicy);
    const auto text   = result && result->status == 200 ? readTextFile(target) : std::nullopt;
    store_.discardStaging(staged);
    if (!result)
    {
        throw std::runtime_error("Unbound's font lookup could not be reached");
    }
    if (result->status != 200 || !text)
    {
        throw std::runtime_error(resolveFailure(result->status));
    }
    return checkedResolution(parseBoundedJSON(*text));
}

nlohmann::json FontService::resolve(const std::string &input)
{
    return resolveLocked(input);
}

struct Variant {
    int  weight;
    bool italic;

    bool operator<(const Variant &other) const
    {
        return std::tie(weight, italic) < std::tie(other.weight, other.italic);
    }
};

static std::optional<std::set<Variant>> variantsOf(const nlohmann::json &value)
{
    if (!value.is_array() || value.empty())
    {
        return std::nullopt;
    }
    std::set<Variant> variants;
    for (const nlohmann::json &variant : value)
    {
        const auto weight =
            fontWeightOf(variant.is_object() ? variant.value("weight", nlohmann::json()) : nullptr);
        if (!weight)
        {
            throw std::runtime_error("A variant needs a weight from 1 to 1000");
        }
        variants.insert({*weight, variant.value("style", "normal") == "italic"});
    }
    return variants;
}

// The provider's family name is the one people know; a link's file says its own.
static bool namesItsFamily(const std::string &provider)
{
    return provider == "google" || provider == "fontsource" || provider == "fontshare";
}

struct Staging {
    const FontStore           &store;
    const nlohmann::json      &resolved;
    std::string                directory;
    std::vector<InstalledFont> faces;
    nlohmann::json             errors = nlohmann::json::array();

    void add(const std::string &name, const std::string &data, const nlohmann::json &file,
             const std::optional<std::set<Variant>> &variants)
    {
        std::string error;
        const auto  face = readFontFace(data, error);
        if (!face)
        {
            errors.push_back(name + ": " + error);
            return;
        }
        const int weight =
            file["weight"].is_number_integer() ? file["weight"].get<int>() : face->weight;
        const bool italic    = file["style"].is_string() ? file["style"] == "italic" : face->italic;
        const std::string id = fontIdFor(face->postScriptName);
        if ((variants && !variants->count({weight, italic})) || findFont(faces, id))
        {
            return;
        }
        const std::string provider = resolved["provider"].get<std::string>();
        const std::string fileName = id + "." + fontFileExtension(sniffFontFile(data));
        if (!writeTextFileAtomically(joinPath(directory, fileName), data))
        {
            errors.push_back(name + ": failed to save it");
            return;
        }
        faces.push_back(
            {id, namesItsFamily(provider) ? resolved["family"].get<std::string>() : face->family,
             face->postScriptName, face->fullName, weight, italic, fileName,
             FontSource{provider, resolved["id"].get<std::string>(), weight,
                        italic ? "italic" : "normal"}});
    }
};

static void stageFile(Staging &staging, const FileDownloader &download, const nlohmann::json &file,
                      size_t index, const std::optional<std::set<Variant>> &variants)
{
    const std::string url    = file["url"].get<std::string>();
    const std::string target = joinPath(staging.directory, "download-" + std::to_string(index));
    const auto        result = download(url, target, {}, kFontPolicy);
    if (!result || result->status != 200)
    {
        staging.errors.push_back("Failed to download " + url +
                                 (result ? ": HTTP " + std::to_string(result->status) : ""));
        return;
    }
    const bool tooLarge = fileSize(target) > kMaxFontDownloadBytes;
    const auto data     = tooLarge ? std::nullopt : readTextFile(target);
    removeFile(target);
    if (!data)
    {
        staging.errors.push_back(url + ": " + (tooLarge ? "larger than 10 MB" : "unreadable"));
        return;
    }

    const FontFileType type = sniffFontFile(*data);
    if (type == FontFileType::Zip)
    {
        ArchiveContents archive = extractFontArchive(*data);
        if (!archive.error.empty())
        {
            staging.errors.push_back(url + ": " + archive.error);
        }
        for (const ArchiveFont &font : archive.fonts)
        {
            staging.add(font.name, font.data, file, variants);
        }
        return;
    }
    if (type == FontFileType::Unknown)
    {
        staging.errors.push_back(url + ": not a font or a zip (a wrong link answers with a page)");
        return;
    }
    staging.add(url, *data, file, variants);
}

nlohmann::json FontService::installLocked(const std::string &input, const nlohmann::json &variants)
{
    const nlohmann::json resolved = resolveLocked(input);
    const auto           wanted   = variantsOf(variants);
    Staging              staging{store_, resolved, store_.stagingDirectory()};

    size_t index = 0;
    for (const nlohmann::json &file : resolved["files"])
    {
        const bool known = file["weight"].is_number_integer();
        const bool skip  = wanted && known &&
                           !wanted->count({file["weight"].get<int>(), file["style"] == "italic"});
        if (!skip)
        {
            stageFile(staging, download_, file, index++, wanted);
        }
    }

    if (staging.faces.empty())
    {
        store_.discardStaging(staging.directory);
        const std::string reason =
            staging.errors.empty() ? "no matching font" : staging.errors[0].get<std::string>();
        throw std::runtime_error("Failed to install " + resolved["family"].get<std::string>() +
                                 ": " + reason);
    }

    nlohmann::json installed = nlohmann::json::array();
    for (const InstalledFont &font : store_.commitInstall(staging.directory, staging.faces))
    {
        installed.push_back(installedFontJSON(font));
    }
    log(LogLevel::Info, LOG_CATEGORY_FONTS,
        "Installed " + std::to_string(installed.size()) + " faces of " +
            resolved["family"].get<std::string>() + ".");
    return {{"installed", std::move(installed)}, {"errors", std::move(staging.errors)}};
}

nlohmann::json FontService::install(const std::string &input, const nlohmann::json &variants)
{
    std::lock_guard<std::mutex> lock(installMutex_);
    return installLocked(input, variants);
}

void FontService::remove(const std::string &id)
{
    if (!store_.remove(id))
    {
        throw std::runtime_error("No installed font has the id " + id);
    }
}

void FontService::setOverride(const std::string &family, const std::optional<std::string> &fontId)
{
    if (!store_.setOverride(family, fontId))
    {
        throw std::runtime_error("No installed font has the id " + fontId.value_or(""));
    }
}

void FontService::setTargets(const nlohmann::json &constants, const nlohmann::json &options)
{
    store_.setFamilies(discordFamilies(constants));
    if (options.is_object() && options.contains("api") && options["api"].is_string())
    {
        setApiOrigin(options["api"].get<std::string>());
    }
}

nlohmann::json FontService::listPresets() const
{
    nlohmann::json presets = nlohmann::json::array();
    for (const FontPreset &preset : store_.state().presets)
    {
        presets.push_back(fontPresetJSON(preset));
    }
    return presets;
}

nlohmann::json FontService::savePreset(const nlohmann::json &value)
{
    nlohmann::json preset = value;
    if (preset.is_object() && !preset.contains("overrides"))
    {
        const FontState state     = store_.state();
        nlohmann::json  overrides = nlohmann::json::object();
        for (const auto &[family, id] : state.overrides)
        {
            if (const InstalledFont *font = findFont(state.fonts, id))
            {
                overrides[family] = fontSourceJSON(font->source);
            }
        }
        preset["overrides"] = std::move(overrides);
    }
    std::string error;
    auto        parsed = parseFontPreset(preset, error);
    if (!parsed)
    {
        throw std::runtime_error(error);
    }
    return fontPresetJSON(store_.savePreset(std::move(*parsed)));
}

void FontService::removePreset(const std::string &id)
{
    if (!store_.removePreset(id))
    {
        throw std::runtime_error("No preset has the id " + id);
    }
}
}
