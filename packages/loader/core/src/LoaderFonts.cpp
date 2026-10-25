#include "LoaderFonts.h"


#include <algorithm>
#include <cstdint>
#include <fstream>
#include <set>

namespace loader
{
    static constexpr uint16_t kFullNameID     = 4;
    static constexpr uint16_t kWindowsPlatform = 3;
    static constexpr uint16_t kMacPlatform     = 1;
    static constexpr uint16_t kEnglishUS       = 0x409;
    static constexpr size_t   kFontHeaderBytes = 16;
    static constexpr size_t   kMaximumNameTableBytes = 1 << 20;

    static std::optional<uint32_t> readU32(const std::string &data, size_t offset)
    {
        if (offset + 4 > data.size())
        {
            return std::nullopt;
        }
        const auto byte = [&](size_t index) { return static_cast<uint32_t>(static_cast<uint8_t>(data[offset + index])); };
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
                unit = 0x10000 + ((unit - 0xD800) << 10) + (low - 0xDC00);
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

    struct TableLocation
    {
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

    static std::optional<std::string> fullNameFromNameTable(const std::string &table)
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
            if (!platform || !language || !nameID || !length || !offset || *nameID != kFullNameID)
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
        return fullNameFromNameTable(data.substr(table->offset, table->length));
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

    std::optional<std::string> fontFullName(const std::string &path)
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

        const auto table = readRange(file, location->offset, location->length);
        return table ? fullNameFromNameTable(*table) : std::nullopt;
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

    static std::optional<FontTarget> findFont(const nlohmann::json &fonts, const std::string &name)
    {
        if (!fonts.is_array())
        {
            return std::nullopt;
        }
        for (const nlohmann::json &font : fonts)
        {
            if (fontName(font) != name)
            {
                continue;
            }
            FontTarget target{name, std::nullopt};
            if (font.is_object() && font.contains("path") && font["path"].is_string())
            {
                target.path = font["path"].get<std::string>();
            }
            return target;
        }
        return std::nullopt;
    }

    std::optional<FontTarget> resolveFontTarget(const nlohmann::json &customFonts, const nlohmann::json &systemFonts,
                                                const std::string &name)
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
        return "Failed to replace \"" + family + "\" with \"" + name + "\". The requested font isn't loaded.";
    }

    nlohmann::json systemFontsFromFiles(const std::vector<std::string> &paths)
    {
        nlohmann::json        fonts = nlohmann::json::array();
        std::set<std::string> seen;
        for (const std::string &path : paths)
        {
            const auto name = fontFullName(path);
            if (name && !name->empty() && seen.insert(*name).second)
            {
                fonts.push_back({{"name", *name}, {"path", path}});
            }
        }
        std::sort(fonts.begin(), fonts.end(), [](const nlohmann::json &left, const nlohmann::json &right) {
            return left["name"].get<std::string>() < right["name"].get<std::string>();
        });
        return fonts;
    }

    std::optional<std::string> fontOverrideFor(const nlohmann::json &overrides, const std::string &family)
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
}
