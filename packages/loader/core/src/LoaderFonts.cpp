#include "LoaderFonts.h"

#include "LoaderFiles.h"

#include <cstdint>

namespace loader
{
    static constexpr uint16_t kFullNameID     = 4;
    static constexpr uint16_t kWindowsPlatform = 3;
    static constexpr uint16_t kMacPlatform     = 1;
    static constexpr uint16_t kEnglishUS       = 0x409;

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

    static std::optional<size_t> nameTableOffset(const std::string &data, size_t fontOffset)
    {
        const auto tables = readU16(data, fontOffset + 4);
        if (!tables)
        {
            return std::nullopt;
        }
        for (uint16_t index = 0; index < *tables; index++)
        {
            const size_t record = fontOffset + 12 + static_cast<size_t>(index) * 16;
            const auto   tag    = readU32(data, record);
            const auto   offset = readU32(data, record + 8);
            if (tag && offset && *tag == 0x6E616D65)
            {
                return *offset;
            }
        }
        return std::nullopt;
    }

    std::optional<std::string> fontFullNameFromData(const std::string &data)
    {
        size_t     fontOffset = 0;
        const auto signature  = readU32(data, 0);
        if (!signature)
        {
            return std::nullopt;
        }
        if (*signature == 0x74746366)
        {
            const auto first = readU32(data, 12);
            if (!first)
            {
                return std::nullopt;
            }
            fontOffset = *first;
        }

        const auto table = nameTableOffset(data, fontOffset);
        if (!table)
        {
            return std::nullopt;
        }
        const auto count   = readU16(data, *table + 2);
        const auto storage = readU16(data, *table + 4);
        if (!count || !storage)
        {
            return std::nullopt;
        }

        std::optional<std::string> windows;
        std::optional<std::string> windowsAny;
        std::optional<std::string> mac;
        for (uint16_t index = 0; index < *count; index++)
        {
            const size_t record   = *table + 6 + static_cast<size_t>(index) * 12;
            const auto   platform = readU16(data, record);
            const auto   language = readU16(data, record + 4);
            const auto   nameID   = readU16(data, record + 6);
            const auto   length   = readU16(data, record + 8);
            const auto   offset   = readU16(data, record + 10);
            if (!platform || !language || !nameID || !length || !offset || *nameID != kFullNameID)
            {
                continue;
            }
            const size_t start = *table + *storage + *offset;
            if (start + *length > data.size() || *length == 0)
            {
                continue;
            }
            if (*platform == kWindowsPlatform)
            {
                std::string text = utf16BigEndianToUTF8(data, start, *length);
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
                mac = data.substr(start, *length);
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

    std::optional<std::string> fontFullName(const std::string &path)
    {
        const auto data = readTextFile(path);
        return data ? fontFullNameFromData(*data) : std::nullopt;
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
