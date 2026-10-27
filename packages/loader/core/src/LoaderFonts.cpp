#include "LoaderFonts.h"

#include <algorithm>
#include <cstdint>
#include <fstream>
#include <set>

namespace loader {
static constexpr uint16_t kFamilyID              = 1;
static constexpr uint16_t kStyleID               = 2;
static constexpr uint16_t kFullNameID            = 4;
static constexpr uint16_t kPostScriptNameID      = 6;
static constexpr uint16_t kTypographicFamilyID   = 16;
static constexpr uint16_t kTypographicStyleID    = 17;
static constexpr uint16_t kWindowsPlatform       = 3;
static constexpr uint16_t kMacPlatform           = 1;
static constexpr uint16_t kEnglishUS             = 0x409;
static constexpr size_t   kFontHeaderBytes       = 16;
static constexpr size_t   kMaximumNameTableBytes = 1 << 20;

static std::optional<uint32_t> readU32(const std::string &data, size_t offset)
{
    if (offset + 4 > data.size())
    {
        return std::nullopt;
    }
    const auto byte = [&](size_t index) {
        return static_cast<uint32_t>(static_cast<uint8_t>(data[offset + index]));
    };
    return (byte(0) << 24) | (byte(1) << 16) | (byte(2) << 8) | byte(3);
}

static std::optional<uint16_t> readU16(const std::string &data, size_t offset)
{
    if (offset + 2 > data.size())
    {
        return std::nullopt;
    }
    return static_cast<uint16_t>((static_cast<uint8_t>(data[offset]) << 8) |
                                 static_cast<uint8_t>(data[offset + 1]));
}

static std::string utf16BigEndianToUTF8(const std::string &data, size_t offset, size_t length)
{
    std::string result;
    for (size_t index = 0; index + 1 < length; index += 2)
    {
        uint32_t unit = (static_cast<uint8_t>(data[offset + index]) << 8) |
                        static_cast<uint8_t>(data[offset + index + 1]);
        if (unit >= 0xD800 && unit <= 0xDBFF && index + 3 < length)
        {
            const uint32_t low = (static_cast<uint8_t>(data[offset + index + 2]) << 8) |
                                 static_cast<uint8_t>(data[offset + index + 3]);
            unit               = 0x10000 + ((unit - 0xD800) << 10) + (low - 0xDC00);
            index += 2;
        }
        if (unit < 0x80)
        {
            result += static_cast<char>(unit);
        }
        else if (unit < 0x800)
        {
            result += static_cast<char>(0xC0 | (unit >> 6));
            result += static_cast<char>(0x80 | (unit & 0x3F));
        }
        else if (unit < 0x10000)
        {
            result += static_cast<char>(0xE0 | (unit >> 12));
            result += static_cast<char>(0x80 | ((unit >> 6) & 0x3F));
            result += static_cast<char>(0x80 | (unit & 0x3F));
        }
        else
        {
            result += static_cast<char>(0xF0 | (unit >> 18));
            result += static_cast<char>(0x80 | ((unit >> 12) & 0x3F));
            result += static_cast<char>(0x80 | ((unit >> 6) & 0x3F));
            result += static_cast<char>(0x80 | (unit & 0x3F));
        }
    }
    return result;
}

struct TableLocation {
    size_t offset = 0;
    size_t length = 0;
};

static std::optional<size_t> fontOffsetIn(const std::string &header)
{
    const auto signature = readU32(header, 0);
    if (!signature)
    {
        return std::nullopt;
    }
    if (*signature != 0x74746366)
    {
        return 0;
    }
    const auto first = readU32(header, 12);
    return first ? std::optional<size_t>(*first) : std::nullopt;
}

static std::optional<TableLocation> nameTableIn(const std::string &directory, size_t fontOffset)
{
    const auto tables = readU16(directory, fontOffset + 4);
    if (!tables)
    {
        return std::nullopt;
    }
    for (uint16_t index = 0; index < *tables; index++)
    {
        const size_t record = fontOffset + 12 + static_cast<size_t>(index) * 16;
        const auto   tag    = readU32(directory, record);
        const auto   offset = readU32(directory, record + 8);
        const auto   length = readU32(directory, record + 12);
        if (tag && offset && length && *tag == 0x6E616D65)
        {
            return TableLocation{*offset, *length};
        }
    }
    return std::nullopt;
}

static std::optional<std::string> nameFromNameTable(const std::string &table, uint16_t wantedID)
{
    const auto count   = readU16(table, 2);
    const auto storage = readU16(table, 4);
    if (!count || !storage)
    {
        return std::nullopt;
    }

    std::optional<std::string> windows;
    std::optional<std::string> windowsAny;
    std::optional<std::string> mac;
    for (uint16_t index = 0; index < *count; index++)
    {
        const size_t record   = 6 + static_cast<size_t>(index) * 12;
        const auto   platform = readU16(table, record);
        const auto   language = readU16(table, record + 4);
        const auto   nameID   = readU16(table, record + 6);
        const auto   length   = readU16(table, record + 8);
        const auto   offset   = readU16(table, record + 10);
        if (!platform || !language || !nameID || !length || !offset || *nameID != wantedID)
        {
            continue;
        }
        const size_t start = *storage + *offset;
        if (start + *length > table.size() || *length == 0)
        {
            continue;
        }
        if (*platform == kWindowsPlatform)
        {
            std::string text = utf16BigEndianToUTF8(table, start, *length);
            if (*language == kEnglishUS && !windows)
            {
                windows = text;
            }
            else if (!windowsAny)
            {
                windowsAny = text;
            }
        }
        else if (*platform == kMacPlatform && !mac)
        {
            mac = table.substr(start, *length);
        }
    }
    if (windows && !windows->empty())
    {
        return windows;
    }
    if (windowsAny && !windowsAny->empty())
    {
        return windowsAny;
    }
    if (mac && !mac->empty())
    {
        return mac;
    }
    return std::nullopt;
}

std::optional<std::string> fontFullNameFromData(const std::string &data)
{
    const auto fontOffset = fontOffsetIn(data);
    const auto table      = fontOffset ? nameTableIn(data, *fontOffset) : std::nullopt;
    if (!table || table->offset + table->length > data.size())
    {
        return std::nullopt;
    }
    return nameFromNameTable(data.substr(table->offset, table->length), kFullNameID);
}

static std::optional<std::string> readRange(std::ifstream &file, size_t offset, size_t length)
{
    std::string buffer(length, '\0');
    file.clear();
    file.seekg(static_cast<std::streamoff>(offset));
    if (!file.read(buffer.data(), static_cast<std::streamsize>(length)))
    {
        return std::nullopt;
    }
    return buffer;
}

static std::optional<std::string> nameTableOfFile(const std::string &path)
{
    std::ifstream file(path, std::ios::binary);
    if (!file)
    {
        return std::nullopt;
    }

    const auto header     = readRange(file, 0, kFontHeaderBytes);
    const auto fontOffset = header ? fontOffsetIn(*header) : std::nullopt;
    const auto tableCount = fontOffset ? readRange(file, *fontOffset, 12) : std::nullopt;
    const auto tables     = tableCount ? readU16(*tableCount, 4) : std::nullopt;
    if (!tables)
    {
        return std::nullopt;
    }

    const auto directory = readRange(file, *fontOffset, 12 + static_cast<size_t>(*tables) * 16);
    const auto location  = directory ? nameTableIn(*directory, 0) : std::nullopt;
    if (!location || location->length > kMaximumNameTableBytes)
    {
        return std::nullopt;
    }
    return readRange(file, location->offset, location->length);
}

static std::optional<FontNames> namesFromTable(const std::string &table)
{
    FontNames names;
    names.postScript = nameFromNameTable(table, kPostScriptNameID);
    names.full       = nameFromNameTable(table, kFullNameID);
    names.family     = nameFromNameTable(table, kTypographicFamilyID);
    if (!names.family)
    {
        names.family = nameFromNameTable(table, kFamilyID);
    }
    names.style = nameFromNameTable(table, kTypographicStyleID);
    if (!names.style)
    {
        names.style = nameFromNameTable(table, kStyleID);
    }
    if (!names.postScript && !names.full)
    {
        return std::nullopt;
    }
    return names;
}

std::optional<FontNames> fontNames(const std::string &path)
{
    const auto table = nameTableOfFile(path);
    return table ? namesFromTable(*table) : std::nullopt;
}

std::optional<FontNames> fontNamesFromData(const std::string &data)
{
    const auto fontOffset = fontOffsetIn(data);
    const auto table      = fontOffset ? nameTableIn(data, *fontOffset) : std::nullopt;
    if (!table || table->offset + table->length > data.size())
    {
        return std::nullopt;
    }
    return namesFromTable(data.substr(table->offset, table->length));
}

std::optional<std::string> fontFullName(const std::string &path)
{
    const auto names = fontNames(path);
    return names ? names->full : std::nullopt;
}

static std::string fileStem(const std::string &path)
{
    const size_t      slash = path.find_last_of('/');
    const std::string file  = slash == std::string::npos ? path : path.substr(slash + 1);
    const size_t      dot   = file.find_last_of('.');
    return dot == std::string::npos ? file : file.substr(0, dot);
}

static nlohmann::json entryFromNames(const std::optional<FontNames> &names, const std::string &path,
                                     const std::string &source, const std::string &fallbackName)
{
    const std::string name = names && names->postScript && !names->postScript->empty()
                                 ? *names->postScript
                             : names && names->full && !names->full->empty() ? *names->full
                                                                             : fallbackName;

    nlohmann::json entry = {{"name", name},
                            {"displayName", names && names->full ? *names->full : name},
                            {"path", path},
                            {"source", source}};
    if (names && names->family)
    {
        entry["family"] = *names->family;
    }
    if (names && names->style)
    {
        entry["style"] = *names->style;
    }
    return entry;
}

nlohmann::json fontEntry(const std::string &path, const std::string &source)
{
    return entryFromNames(fontNames(path), path, source, fileStem(path));
}

nlohmann::json fontEntryFromData(const std::string &data, const std::string &path,
                                 const std::string &source, const std::string &name)
{
    nlohmann::json entry = entryFromNames(fontNamesFromData(data), path, source, name);
    entry["name"]        = name;
    return entry;
}

static std::optional<std::string> fontName(const nlohmann::json &font)
{
    if (font.is_string())
    {
        return font.get<std::string>();
    }
    if (font.is_object() && font.contains("name") && font["name"].is_string())
    {
        return font["name"].get<std::string>();
    }
    return std::nullopt;
}

static bool fontMatches(const nlohmann::json &font, const std::string &name)
{
    if (fontName(font) == name)
    {
        return true;
    }
    return font.is_object() && font.contains("displayName") && font["displayName"].is_string() &&
           font["displayName"].get<std::string>() == name;
}

static std::optional<FontTarget> findFont(const nlohmann::json &fonts, const std::string &name)
{
    if (!fonts.is_array())
    {
        return std::nullopt;
    }
    for (const nlohmann::json &font : fonts)
    {
        if (!fontMatches(font, name))
        {
            continue;
        }
        FontTarget target{fontName(font).value_or(name), std::nullopt};
        if (font.is_object() && font.contains("path") && font["path"].is_string())
        {
            target.path = font["path"].get<std::string>();
        }
        return target;
    }
    return std::nullopt;
}

std::optional<FontTarget> resolveFontTarget(const nlohmann::json &customFonts,
                                            const nlohmann::json &systemFonts,
                                            const std::string    &name)
{
    if (name.empty())
    {
        return std::nullopt;
    }
    if (auto custom = findFont(customFonts, name))
    {
        return custom;
    }
    return findFont(systemFonts, name);
}

std::string fontUnavailableMessage(const std::string &family, const std::string &name)
{
    return "Failed to replace \"" + family + "\" with \"" + name +
           "\". The requested font isn't loaded.";
}

nlohmann::json fontTargetJSON(const nlohmann::json &customFonts, const nlohmann::json &systemFonts,
                              const std::string &family, const std::string &name)
{
    const auto font = resolveFontTarget(customFonts, systemFonts, name);
    if (!font)
    {
        return {{"name", name}, {"error", fontUnavailableMessage(family, name)}};
    }
    nlohmann::json target = {{"name", font->name}};
    if (font->path)
    {
        target["path"] = *font->path;
    }
    return target;
}

nlohmann::json fontOverrideTargets(const nlohmann::json &overrides,
                                   const nlohmann::json &customFonts,
                                   const nlohmann::json &systemFonts)
{
    nlohmann::json targets = nlohmann::json::object();
    if (!overrides.is_object())
    {
        return targets;
    }
    for (const auto &[family, value] : overrides.items())
    {
        if (value.is_string() && !value.get<std::string>().empty())
        {
            targets[family] =
                fontTargetJSON(customFonts, systemFonts, family, value.get<std::string>());
        }
    }
    return targets;
}

nlohmann::json systemFontsFromFiles(const std::vector<std::string> &paths,
                                    const std::string              &source)
{
    nlohmann::json        fonts = nlohmann::json::array();
    std::set<std::string> seen;
    for (const std::string &path : paths)
    {
        if (!fontNames(path))
        {
            continue;
        }
        nlohmann::json entry = fontEntry(path, source);
        if (seen.insert(entry["name"].get<std::string>()).second)
        {
            fonts.push_back(std::move(entry));
        }
    }
    std::sort(fonts.begin(), fonts.end(),
              [](const nlohmann::json &left, const nlohmann::json &right) {
                  return left["name"].get<std::string>() < right["name"].get<std::string>();
              });
    return fonts;
}

nlohmann::json fontCatalog(const nlohmann::json &customFonts, const nlohmann::json &platformFonts)
{
    nlohmann::json        catalog = nlohmann::json::array();
    std::set<std::string> seen;
    for (const nlohmann::json *list : {&customFonts, &platformFonts})
    {
        if (!list->is_array())
        {
            continue;
        }
        for (const nlohmann::json &font : *list)
        {
            const auto name = fontName(font);
            if (!name || name->empty() || !seen.insert(*name).second)
            {
                continue;
            }
            catalog.push_back(font.is_object() ? font
                                               : nlohmann::json{{"name", *name},
                                                                {"displayName", *name},
                                                                {"source", "system"}});
        }
    }
    return catalog;
}

nlohmann::json fontNamesOf(const nlohmann::json &fonts)
{
    nlohmann::json names = nlohmann::json::array();
    for (const nlohmann::json &font : fonts)
    {
        if (const auto name = fontName(font))
        {
            names.push_back(*name);
        }
    }
    return names;
}

std::optional<std::string> fontOverrideFor(const nlohmann::json &overrides,
                                           const std::string    &family)
{
    if (!overrides.is_object())
    {
        return std::nullopt;
    }
    for (const std::string &key : {std::string(kAllFontFamilies), family})
    {
        const auto value = overrides.find(key);
        if (value != overrides.end() && value->is_string() && !value->get<std::string>().empty())
        {
            return value->get<std::string>();
        }
    }
    return std::nullopt;
}

static std::string errorText(const nlohmann::json &error)
{
    return error.is_string() ? error.get<std::string>() : error.dump();
}

FontOverridePlan FontOverrideRegistry::plan(const nlohmann::json &targets)
{
    FontOverridePlan            plan;
    std::lock_guard<std::mutex> lock(mutex_);
    if (!targets.is_object())
    {
        return plan;
    }
    for (const auto &[family, target] : targets.items())
    {
        if (!target.is_object())
        {
            continue;
        }
        const auto error = target.find("error");
        if (error != target.end() && !error->is_null())
        {
            plan.errors.push_back(errorText(*error));
            continue;
        }
        const auto path = target.find("path");
        if (path != target.end() && path->is_string() &&
            registered_.insert(path->get<std::string>()).second)
        {
            plan.registrations.push_back(path->get<std::string>());
        }
        const auto name = target.find("name");
        if (name != target.end() && name->is_string())
        {
            plan.table[family] = name->get<std::string>();
        }
    }
    const auto everyFamily = plan.table.find(kAllFontFamilies);
    if (everyFamily != plan.table.end())
    {
        plan.table = {{kAllFontFamilies, everyFamily->second}};
    }
    return plan;
}

nlohmann::json fontOverridePlanJSON(const FontOverridePlan &plan)
{
    return {{"registrations", plan.registrations}, {"errors", plan.errors}, {"table", plan.table}};
}

std::optional<std::string> fontOverrideLookup(const FontOverrideTable &table,
                                              const std::string       &name)
{
    for (const std::string &key : {name, std::string(kAllFontFamilies)})
    {
        const auto found = table.find(key);
        if (found != table.end())
        {
            return found->second;
        }
    }
    return std::nullopt;
}
}
