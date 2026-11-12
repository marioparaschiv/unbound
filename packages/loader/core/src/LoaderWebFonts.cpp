#include <cstdint>
#include <new>
#include <woff2/decode.h>
#include <woff2/output.h>

#include "LoaderFontFiles.h"

#include "miniz/miniz_config.h"

// WOFF and WOFF2 unpacked into the TrueType or OpenType font they wrap, so both platforms only
// ever register plain font files.
namespace loader::fonts {
static constexpr uint32_t kWOFFTag         = 0x774F4646; // wOFF
static constexpr uint32_t kWOFF2Tag        = 0x774F4632; // wOF2
static constexpr size_t   kWOFFHeaderBytes = 44;
static constexpr size_t   kWOFFEntryBytes  = 20;
static constexpr uint16_t kMaximumTables   = 512;

static std::optional<uint32_t> readU32(const std::string &data, size_t offset)
{
    if (offset > data.size() || data.size() - offset < 4)
    {
        return std::nullopt;
    }
    const auto byte = [&](size_t index) {
        return static_cast<uint32_t>(static_cast<uint8_t>(data[offset + index]));
    };
    return (byte(0) << 24) | (byte(1) << 16) | (byte(2) << 8) | byte(3);
}

static void appendU16(std::string &data, uint32_t value)
{
    data += static_cast<char>((value >> 8) & 0xFF);
    data += static_cast<char>(value & 0xFF);
}

static void appendU32(std::string &data, uint32_t value)
{
    appendU16(data, value >> 16);
    appendU16(data, value & 0xFFFF);
}

struct WOFFTable {
    uint32_t    tag;
    uint32_t    checksum;
    std::string data;
};

// The sfnt header with its binary-search fields, as the OpenType spec defines them.
static std::string sfntHeader(uint32_t flavor, size_t tables)
{
    uint32_t power = 1;
    uint32_t log   = 0;
    while (power * 2 <= tables)
    {
        power *= 2;
        log++;
    }
    std::string header;
    appendU32(header, flavor);
    appendU16(header, static_cast<uint32_t>(tables));
    appendU16(header, power * 16);
    appendU16(header, log);
    appendU16(header, static_cast<uint32_t>(tables) * 16 - power * 16);
    return header;
}

static std::optional<std::string> decodeWOFF(const std::string &data, std::string &error)
{
    const auto flavor = readU32(data, 4);
    const auto count  = readU32(data, 12);
    const auto total  = readU32(data, 16);
    const auto tables = count ? *count >> 16 : 0;
    if (!flavor || !total || data.size() < kWOFFHeaderBytes || tables == 0 ||
        tables > kMaximumTables || *total > kMaxDecodedFontBytes)
    {
        error = "The WOFF font is damaged";
        return std::nullopt;
    }

    std::vector<WOFFTable> entries;
    size_t                 size = 12 + tables * 16;
    for (uint32_t index = 0; index < tables; index++)
    {
        const size_t record     = kWOFFHeaderBytes + index * kWOFFEntryBytes;
        const auto   tag        = readU32(data, record);
        const auto   offset     = readU32(data, record + 4);
        const auto   compressed = readU32(data, record + 8);
        const auto   length     = readU32(data, record + 12);
        const auto   checksum   = readU32(data, record + 16);
        if (!tag || !offset || !compressed || !length || !checksum || *offset > data.size() ||
            data.size() - *offset < *compressed || *compressed > *length ||
            *length > kMaxDecodedFontBytes || size + *length > kMaxDecodedFontBytes)
        {
            error = "The WOFF font is damaged";
            return std::nullopt;
        }
        std::string table(*length, '\0');
        if (*compressed == *length)
        {
            table.assign(data, *offset, *length);
        }
        else
        {
            mz_ulong inflated = *length;
            if (mz_uncompress(reinterpret_cast<unsigned char *>(table.data()), &inflated,
                              reinterpret_cast<const unsigned char *>(data.data() + *offset),
                              *compressed) != MZ_OK ||
                inflated != *length)
            {
                error = "The WOFF font has a table that does not unpack";
                return std::nullopt;
            }
        }
        size += (table.size() + 3) & ~size_t(3);
        entries.push_back({*tag, *checksum, std::move(table)});
    }

    std::string font   = sfntHeader(*flavor, entries.size());
    size_t      offset = 12 + entries.size() * 16;
    for (const WOFFTable &entry : entries)
    {
        appendU32(font, entry.tag);
        appendU32(font, entry.checksum);
        appendU32(font, static_cast<uint32_t>(offset));
        appendU32(font, static_cast<uint32_t>(entry.data.size()));
        offset += (entry.data.size() + 3) & ~size_t(3);
    }
    for (const WOFFTable &entry : entries)
    {
        font += entry.data;
        font.append((4 - entry.data.size() % 4) % 4, '\0');
    }
    return font;
}

static std::optional<std::string> decodeWOFF2(const std::string &data, std::string &error)
{
    const auto  *bytes = reinterpret_cast<const uint8_t *>(data.data());
    std::string  font;
    const size_t size = woff2::ComputeWOFF2FinalSize(bytes, data.size());
    if (size == 0 || size > kMaxDecodedFontBytes)
    {
        error = "The WOFF2 font is damaged or unpacks past the font size limit";
        return std::nullopt;
    }
    try
    {
        font.reserve(size);
        woff2::WOFF2StringOut out(&font);
        out.SetMaxSize(kMaxDecodedFontBytes);
        if (!woff2::ConvertWOFF2ToTTF(bytes, data.size(), &out))
        {
            error = "The WOFF2 font is damaged";
            return std::nullopt;
        }
    }
    catch (const std::bad_alloc &)
    {
        error = "The WOFF2 font is too large to unpack";
        return std::nullopt;
    }
    return font;
}

std::optional<std::string> decodeWebFont(const std::string &data, std::string &error)
{
    switch (readU32(data, 0).value_or(0))
    {
        case kWOFFTag:
            return decodeWOFF(data, error);
        case kWOFF2Tag:
            return decodeWOFF2(data, error);
        default:
            error = "The file is not a WOFF or WOFF2 font";
            return std::nullopt;
    }
}
}
