#pragma once

// Builds small but well-formed fonts and zips for the font tests and fuzzers.

#include <cstdint>
#include <string>
#include <vector>

#include "miniz/miniz_config.h"

namespace font_fixtures {
inline void appendU16(std::string &data, uint16_t value)
{
    data += static_cast<char>(value >> 8);
    data += static_cast<char>(value & 0xFF);
}

inline void appendU32(std::string &data, uint32_t value)
{
    appendU16(data, static_cast<uint16_t>(value >> 16));
    appendU16(data, static_cast<uint16_t>(value & 0xFFFF));
}

inline std::string utf16(const std::string &text)
{
    std::string encoded;
    for (char character : text)
    {
        appendU16(encoded, static_cast<uint16_t>(static_cast<unsigned char>(character)));
    }
    return encoded;
}

struct FaceSpec {
    std::string family     = "Test Sans";
    std::string postScript = "TestSans-Regular";
    std::string full       = "Test Sans Regular";
    uint16_t    weight     = 400;
    bool        italic     = false;
    bool        variable   = false;
    bool        openType   = false;
    bool        withOS2    = true;
};

inline std::string nameTable(const FaceSpec &spec)
{
    struct Record {
        uint16_t    id;
        std::string text;
    };
    const std::vector<Record> records = {
        {1, utf16(spec.family)}, {4, utf16(spec.full)}, {6, utf16(spec.postScript)}};
    std::string strings;
    std::string table;
    appendU16(table, 0);
    appendU16(table, static_cast<uint16_t>(records.size()));
    appendU16(table, static_cast<uint16_t>(6 + records.size() * 12));
    for (const Record &record : records)
    {
        appendU16(table, 3);
        appendU16(table, 1);
        appendU16(table, 0x409);
        appendU16(table, record.id);
        appendU16(table, static_cast<uint16_t>(record.text.size()));
        appendU16(table, static_cast<uint16_t>(strings.size()));
        strings += record.text;
    }
    return table + strings;
}

inline std::string font(const FaceSpec &spec = {})
{
    std::string head(54, '\0');
    head[12] = '\x5F', head[13] = '\x0F', head[14] = '\x3C', head[15] = '\xF5';
    head[45] = spec.italic ? 0x2 : 0;
    std::string os2(78, '\0');
    os2[4]  = static_cast<char>(spec.weight >> 8);
    os2[5]  = static_cast<char>(spec.weight & 0xFF);
    os2[63] = spec.italic ? 0x1 : 0;

    std::vector<std::pair<std::string, std::string>> tables = {
        {spec.openType ? "CFF " : "glyf", std::string(4, '\0')},
        {"cmap", std::string(4, '\0')},
        {"head", head},
        {"name", nameTable(spec)}};
    if (spec.withOS2)
    {
        tables.push_back({"OS/2", os2});
    }
    if (spec.variable)
    {
        tables.push_back({"fvar", std::string(16, '\0')});
    }

    std::string data;
    appendU32(data, spec.openType ? 0x4F54544F : 0x00010000);
    appendU16(data, static_cast<uint16_t>(tables.size()));
    appendU16(data, 0);
    appendU16(data, 0);
    appendU16(data, 0);
    size_t offset = 12 + tables.size() * 16;
    for (const auto &[tag, body] : tables)
    {
        data += tag;
        appendU32(data, 0);
        appendU32(data, static_cast<uint32_t>(offset));
        appendU32(data, static_cast<uint32_t>(body.size()));
        offset += body.size();
    }
    for (const auto &[tag, body] : tables)
    {
        data += body;
    }
    return data;
}

inline std::string collection(const std::string &first)
{
    std::string data = "ttcf";
    appendU32(data, 0x00010000);
    appendU32(data, 1);
    appendU32(data, 16);
    // Table offsets in a collection count from the file start, so shift the inner directory.
    std::string inner = first;
    const auto  count = static_cast<uint16_t>((static_cast<uint8_t>(inner[4]) << 8) |
                                              static_cast<uint8_t>(inner[5]));
    for (uint16_t index = 0; index < count; index++)
    {
        const size_t record = 12 + index * 16 + 8;
        uint32_t     value  = 0;
        for (int byte = 0; byte < 4; byte++)
        {
            value = (value << 8) | static_cast<uint8_t>(inner[record + byte]);
        }
        value += 16;
        for (int byte = 3; byte >= 0; byte--)
        {
            inner[record + byte] = static_cast<char>(value & 0xFF);
            value >>= 8;
        }
    }
    return data + inner;
}

struct ZipEntry {
    std::string name;
    std::string data;
    // Overrides the uncompressed size the directory declares, to fake a zip bomb.
    uint32_t declaredSize = 0xFFFFFFFF;
};

// `data` as a deflate stream of one stored block, so an entry can use method 8 (deflate), whose
// declared size miniz cannot check against the stored bytes up front.
inline std::string deflateStored(const std::string &data)
{
    const auto  length = static_cast<uint16_t>(data.size());
    std::string stream(1, '\x01');
    stream += static_cast<char>(length & 0xFF);
    stream += static_cast<char>(length >> 8);
    stream += static_cast<char>(~length & 0xFF);
    stream += static_cast<char>((~length >> 8) & 0xFF);
    return stream + data;
}

// A zip of stored (uncompressed) entries, written by hand since the loader's miniz only reads.
inline std::string zip(const std::vector<ZipEntry> &entries)
{
    // Zip fields are little-endian, unlike font tables.
    auto le16 = [](std::string &out, uint16_t value) {
        out += static_cast<char>(value & 0xFF);
        out += static_cast<char>(value >> 8);
    };
    auto le32 = [&](std::string &out, uint32_t value) {
        le16(out, static_cast<uint16_t>(value & 0xFFFF));
        le16(out, static_cast<uint16_t>(value >> 16));
    };
    std::string localLE;
    std::string centralLE;
    for (const ZipEntry &entry : entries)
    {
        const auto crc = static_cast<uint32_t>(
            mz_crc32(MZ_CRC32_INIT, reinterpret_cast<const unsigned char *>(entry.data.data()),
                     entry.data.size()));
        // A faked size needs deflate: miniz refuses a stored entry whose two sizes differ.
        const bool        deflate  = entry.declaredSize != 0xFFFFFFFF;
        const std::string stored   = deflate ? deflateStored(entry.data) : entry.data;
        const uint32_t    size     = static_cast<uint32_t>(stored.size());
        const uint32_t    declared = deflate ? entry.declaredSize : size;
        const uint16_t    method   = deflate ? 8 : 0;
        const uint32_t    offset   = static_cast<uint32_t>(localLE.size());
        le32(localLE, 0x04034B50);
        le16(localLE, 20);
        le16(localLE, 0);
        le16(localLE, method);
        le16(localLE, 0);
        le16(localLE, 0);
        le32(localLE, crc);
        le32(localLE, size);
        le32(localLE, declared);
        le16(localLE, static_cast<uint16_t>(entry.name.size()));
        le16(localLE, 0);
        localLE += entry.name;
        localLE += stored;

        le32(centralLE, 0x02014B50);
        le16(centralLE, 20);
        le16(centralLE, 20);
        le16(centralLE, 0);
        le16(centralLE, method);
        le16(centralLE, 0);
        le16(centralLE, 0);
        le32(centralLE, crc);
        le32(centralLE, size);
        le32(centralLE, declared);
        le16(centralLE, static_cast<uint16_t>(entry.name.size()));
        le16(centralLE, 0);
        le16(centralLE, 0);
        le16(centralLE, 0);
        le16(centralLE, 0);
        le32(centralLE, 0);
        le32(centralLE, offset);
        centralLE += entry.name;
    }
    std::string end;
    le32(end, 0x06054B50);
    le16(end, 0);
    le16(end, 0);
    le16(end, static_cast<uint16_t>(entries.size()));
    le16(end, static_cast<uint16_t>(entries.size()));
    le32(end, static_cast<uint32_t>(centralLE.size()));
    le32(end, static_cast<uint32_t>(localLE.size()));
    le16(end, 0);
    return localLE + centralLE + end;
}
}
