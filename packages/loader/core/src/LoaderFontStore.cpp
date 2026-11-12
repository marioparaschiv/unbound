#include "LoaderFontStore.h"

#include <algorithm>
#include <atomic>
#include <cctype>
#include <chrono>
#include <filesystem>
#include <random>
#include <set>
#include <stdexcept>

#include "LoaderFiles.h"
#include "LoaderFontFiles.h"
#include "LoaderFontVariations.h"
#include "LoaderJSON.h"
#include "LoaderLog.h"

namespace loader::fonts {
namespace fs = std::filesystem;

static constexpr const char *kStateFile    = "state.json";
static constexpr const char *kFilesFolder  = "files";
static constexpr const char *kStageFolder  = ".staging";
static constexpr size_t      kMaximumFonts = 512;

FontStore::FontStore(std::string documents) : directory_(joinPath(documents, "Fonts")) {}

static std::string statePath(const std::string &directory)
{
    return joinPath(directory, kStateFile);
}

static std::string uniqueId(const std::vector<InstalledFont> &fonts, const std::string &base)
{
    std::string id = base;
    for (int suffix = 2; findFont(fonts, id); suffix++)
    {
        id = base.substr(0, 120) + "-" + std::to_string(suffix);
    }
    return id;
}

// The font files a loader before `state.json` left at the top of the folder, kept where they are.
static std::vector<InstalledFont> adoptLooseFonts(const std::string &directory)
{
    std::vector<InstalledFont> fonts;
    for (const std::string &name : listDirectory(directory))
    {
        const std::string path = joinPath(directory, name);
        if (name.starts_with(".") || name == kStateFile || isDirectory(path) ||
            fileSize(path) > kMaxFontDownloadBytes || fonts.size() == kMaximumFonts)
        {
            continue;
        }
        const auto  data = readTextFile(path);
        std::string error;
        const auto  face = data ? readFontFace(*data, error) : std::nullopt;
        if (!face)
        {
            log(LogLevel::Warning, LOG_CATEGORY_FONTS,
                "Failed to adopt font " + name + ": " + (error.empty() ? "unreadable" : error));
            continue;
        }
        fonts.push_back(
            {uniqueId(fonts, fontIdFor(face->postScriptName)), face->family, face->postScriptName,
             face->fullName, face->weight, face->italic, name,
             FontSource{kLocalProvider, face->postScriptName, std::nullopt, std::nullopt},
             face->axes, instanceCoordinates(face->axes, {}, error).value_or(FontVariations{})});
    }
    return fonts;
}

static std::map<std::string, std::string> migrateOverrides(const std::vector<InstalledFont> &fonts,
                                                           const nlohmann::json             &legacy)
{
    std::map<std::string, std::string> overrides;
    if (!legacy.is_object())
    {
        return overrides;
    }
    for (const auto &[family, value] : legacy.items())
    {
        const std::string name = value.is_string() ? value.get<std::string>() : "";
        const auto found = std::find_if(fonts.begin(), fonts.end(), [&](const InstalledFont &font) {
            return !name.empty() &&
                   (font.postScriptName == name || font.fullName == name || font.id == name);
        });
        if (found != fonts.end())
        {
            overrides[family] = found->id;
        }
        else if (!name.empty())
        {
            log(LogLevel::Warning, LOG_CATEGORY_FONTS,
                "Dropped the override of " + family + ": " + name + " is not an installed font");
        }
    }
    return overrides;
}

void FontStore::open(const nlohmann::json &legacyOverrides)
{
    std::lock_guard<std::mutex> lock(mutex_);
    if (opened_)
    {
        return;
    }
    opened_ = true;
    createDirectories(directory_);
    removeTree(directory_, kStageFolder);

    const auto text = readTextFile(statePath(directory_));
    if (text)
    {
        state_ = parseFontState(parseBoundedJSON(*text));
    }
    else
    {
        state_.fonts     = adoptLooseFonts(directory_);
        state_.overrides = migrateOverrides(state_.fonts, legacyOverrides);
        log(LogLevel::Info, LOG_CATEGORY_FONTS,
            "Migrated " + std::to_string(state_.fonts.size()) + " fonts and " +
                std::to_string(state_.overrides.size()) + " overrides into state.json.");
    }

    // A font whose file is gone (wiped by hand) leaves the state, with its overrides.
    const size_t before = state_.fonts.size();
    std::erase_if(state_.fonts, [&](const InstalledFont &font) {
        return !isContainedRelativePath(font.file) || !fileExists(pathOf(font));
    });
    std::erase_if(state_.overrides, [&](const auto &entry) {
        return !findFont(state_.fonts, entry.second);
    });
    if (!text || before != state_.fonts.size())
    {
        writeTextFileAtomically(statePath(directory_), toJSON(fontStateJSON(state_)));
    }
}

void FontStore::setOnChange(std::function<void()> onChange)
{
    std::lock_guard<std::mutex> lock(mutex_);
    onChange_ = std::move(onChange);
}

FontState FontStore::state() const
{
    std::lock_guard<std::mutex> lock(mutex_);
    return state_;
}

DiscordFamilies FontStore::families() const
{
    std::lock_guard<std::mutex> lock(mutex_);
    return families_;
}

void FontStore::setFamilies(DiscordFamilies families)
{
    std::lock_guard<std::mutex> lock(mutex_);
    families_ = std::move(families);
}

std::string FontStore::directory() const
{
    return directory_;
}

std::string FontStore::pathOf(const InstalledFont &font) const
{
    return joinPath(directory_, font.file);
}

std::string FontStore::stagingDirectory() const
{
    static std::atomic<uint64_t> counter{0};
    const auto        stamp = std::chrono::steady_clock::now().time_since_epoch().count();
    const std::string name  = std::to_string(stamp) + "-" + std::to_string(counter++) + "-" +
                              std::to_string(std::random_device{}() & 0xFFFF);
    const std::string path  = joinPath(joinPath(directory_, kStageFolder), name);
    createDirectories(path);
    return path;
}

void FontStore::discardStaging(const std::string &staged) const
{
    removeTree(directory_, std::string(kStageFolder) + "/" + fs::path(staged).filename().string());
}

bool FontStore::update(const std::function<bool(FontState &)> &change)
{
    {
        std::lock_guard<std::mutex> lock(mutex_);
        FontState                   next = state_;
        if (!change(next))
        {
            return false;
        }
        if (!writeTextFileAtomically(statePath(directory_), toJSON(fontStateJSON(next))))
        {
            throw std::runtime_error("Failed to save the font state");
        }
        state_ = std::move(next);
    }
    notify();
    return true;
}

void FontStore::notify()
{
    std::function<void()> onChange;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        onChange = onChange_;
    }
    if (onChange)
    {
        onChange();
    }
}

// Deletes `file` unless a face of `state` still draws from it, as a variable font's faces share
// one.
static void removeFontFile(const std::string &directory, const FontState &state,
                           const std::string &file)
{
    const bool shared =
        std::any_of(state.fonts.begin(), state.fonts.end(), [&](const InstalledFont &font) {
            return font.file == file;
        });
    if (shared || !isContainedRelativePath(file))
    {
        return;
    }
    removeFile(joinPath(directory, file));
    // Drops the install's folder once its last face is gone.
    const fs::path  parent = fs::path(file).parent_path();
    std::error_code error;
    if (!parent.empty() && fs::is_empty(fs::path(directory) / parent, error))
    {
        fs::remove(fs::path(directory) / parent, error);
    }
}

std::vector<InstalledFont> FontStore::commitInstall(const std::string         &staged,
                                                    std::vector<InstalledFont> faces)
{
    const std::string name   = fs::path(staged).filename().string();
    const std::string target = joinPath(joinPath(directory_, kFilesFolder), name);
    createDirectories(joinPath(directory_, kFilesFolder));
    std::error_code error;
    fs::rename(staged, target, error);
    if (error)
    {
        throw std::runtime_error("Failed to move the downloaded fonts into place: " +
                                 error.message());
    }
    for (InstalledFont &face : faces)
    {
        face.file = std::string(kFilesFolder) + "/" + name + "/" + face.file;
    }

    std::vector<std::string> replaced;
    try
    {
        update([&](FontState &state) {
            for (const InstalledFont &face : faces)
            {
                const auto existing = std::find_if(state.fonts.begin(), state.fonts.end(),
                                                   [&](const InstalledFont &font) {
                                                       return font.id == face.id;
                                                   });
                if (existing != state.fonts.end())
                {
                    replaced.push_back(existing->file);
                    *existing = face;
                }
                else if (state.fonts.size() < kMaximumFonts)
                {
                    state.fonts.push_back(face);
                }
            }
            return true;
        });
    }
    catch (...)
    {
        removeTree(directory_, std::string(kFilesFolder) + "/" + name);
        throw;
    }
    const FontState current = state();
    for (const std::string &file : replaced)
    {
        removeFontFile(directory_, current, file);
    }
    return faces;
}

bool FontStore::remove(const std::string &id)
{
    std::string file;
    const bool  removed = update([&](FontState &state) {
        const InstalledFont *font = findFont(state.fonts, id);
        if (!font)
        {
            return false;
        }
        file = font->file;
        std::erase_if(state.fonts, [&](const InstalledFont &entry) {
            return entry.id == id;
        });
        std::erase_if(state.overrides, [&](const auto &entry) {
            return entry.second == id;
        });
        return true;
    });
    if (removed)
    {
        removeFontFile(directory_, state(), file);
    }
    return removed;
}

InstalledFont FontStore::addInstance(const std::string &id, const FontVariations &variations)
{
    InstalledFont added;
    update([&](FontState &state) {
        const InstalledFont *base = findFont(state.fonts, id);
        if (!base)
        {
            throw std::runtime_error("No installed font has the id " + id);
        }
        if (base->axes.empty())
        {
            throw std::runtime_error(base->fullName + " is not a variable font");
        }
        std::string error;
        const auto  coordinates = instanceCoordinates(base->axes, variations, error);
        if (!coordinates)
        {
            throw std::runtime_error(error);
        }
        // The same coordinates of the same file are the face already installed.
        const auto existing =
            std::find_if(state.fonts.begin(), state.fonts.end(), [&](const InstalledFont &font) {
                return font.file == base->file && font.variations == *coordinates;
            });
        if (existing != state.fonts.end())
        {
            added = *existing;
            return false;
        }
        if (state.fonts.size() >= kMaximumFonts)
        {
            throw std::runtime_error("There are too many fonts");
        }
        // `base` may be any instance, so the defaults get a name of their own.
        FontFace font;
        font.family          = base->family;
        font.postScriptName  = fontIdFor(base->family) + "-Default";
        font.fullName        = base->family + " Default";
        font.weight          = base->weight;
        font.italic          = base->italic;
        font.axes            = base->axes;
        const FontFace face  = instanceFace(font, *coordinates);
        added                = *base;
        added.id             = uniqueId(state.fonts, fontIdFor(face.postScriptName));
        added.postScriptName = face.postScriptName;
        added.fullName       = face.fullName;
        added.weight         = face.weight;
        added.italic         = face.italic;
        added.variations     = *coordinates;
        added.source.weight  = face.weight;
        added.source.style   = face.italic ? "italic" : "normal";
        state.fonts.push_back(added);
        return true;
    });
    return added;
}

bool FontStore::setOverride(const std::string &key, const std::optional<std::string> &fontId)
{
    const DiscordFamilies known = families();
    bool                  valid = true;
    update([&](FontState &state) {
        auto overrides = withOverride(state, known, key, fontId);
        valid          = overrides.has_value();
        if (!valid || *overrides == state.overrides)
        {
            return false;
        }
        state.overrides = std::move(*overrides);
        return true;
    });
    return valid;
}

void FontStore::replaceOverrides(std::map<std::string, std::string> overrides)
{
    update([&](FontState &state) {
        std::erase_if(overrides, [&](const auto &entry) {
            return !findFont(state.fonts, entry.second);
        });
        state.overrides = std::move(overrides);
        return true;
    });
}

static std::string presetIdFor(const std::vector<FontPreset> &presets, const std::string &name)
{
    std::string base;
    for (unsigned char character : name)
    {
        if (std::isalnum(character))
        {
            base += static_cast<char>(std::tolower(character));
        }
        else if (!base.empty() && base.back() != '-')
        {
            base += '-';
        }
    }
    while (!base.empty() && base.back() == '-')
    {
        base.pop_back();
    }
    base           = base.empty() ? "preset" : base;
    std::string id = base;
    for (int suffix = 2; std::any_of(presets.begin(), presets.end(),
                                     [&](const FontPreset &preset) {
                                         return preset.id == id;
                                     });
         suffix++)
    {
        id = base + "-" + std::to_string(suffix);
    }
    return id;
}

FontPreset FontStore::savePreset(FontPreset preset)
{
    update([&](FontState &state) {
        const auto existing =
            std::find_if(state.presets.begin(), state.presets.end(), [&](const FontPreset &entry) {
                return entry.id == preset.id;
            });
        if (!preset.id.empty() && existing != state.presets.end())
        {
            *existing = preset;
            return true;
        }
        if (state.presets.size() >= kMaximumFonts)
        {
            throw std::runtime_error("There are too many presets");
        }
        preset.id = presetIdFor(state.presets, preset.name);
        state.presets.push_back(preset);
        return true;
    });
    return preset;
}

bool FontStore::removePreset(const std::string &id)
{
    return update([&](FontState &state) {
        return std::erase_if(state.presets, [&](const FontPreset &preset) {
                   return preset.id == id;
               }) > 0;
    });
}

static nlohmann::json targetOf(const std::string &directory, const InstalledFont &font)
{
    nlohmann::json target = {{"name", font.postScriptName},
                             {"path", joinPath(directory, font.file)}};
    if (!font.variations.empty())
    {
        target["variations"] = font.variations;
    }
    return target;
}

nlohmann::json FontStore::overrideTargets() const
{
    std::lock_guard<std::mutex> lock(mutex_);
    nlohmann::json              targets = nlohmann::json::object();
    for (const auto &[family, id] : state_.overrides)
    {
        if (const InstalledFont *font = findFont(state_.fonts, id))
        {
            targets[family] = targetOf(directory_, *font);
        }
    }
    return targets;
}

std::optional<nlohmann::json> FontStore::overrideTarget(const std::string &family) const
{
    std::lock_guard<std::mutex> lock(mutex_);
    // An installed face's own name draws that face, so settings can preview it before it overrides.
    const auto own =
        std::find_if(state_.fonts.begin(), state_.fonts.end(), [&](const InstalledFont &font) {
            return font.postScriptName == family;
        });
    if (own != state_.fonts.end())
    {
        return targetOf(directory_, *own);
    }
    for (const std::string &key : {std::string("*"), family})
    {
        const auto found = state_.overrides.find(key);
        const auto font =
            found == state_.overrides.end() ? nullptr : findFont(state_.fonts, found->second);
        if (font)
        {
            return targetOf(directory_, *font);
        }
    }
    return std::nullopt;
}
}
