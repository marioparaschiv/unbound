#include "LoaderFontFiles.h"

#include <algorithm>
#include <cctype>
#include <cstdint>

#include "LoaderFonts.h"

#include "miniz/miniz_config.h"

namespace loader::fonts {
static constexpr uint32_t kTrueTypeTag   = 0x00010000;
static constexpr uint32_t kOpenTypeTag   = 0x4F54544F; // OTTO
static constexpr uint32_t kAppleTrueType = 0x74727565; // true
static constexpr uint32_t kCollectionTag = 0x74746366; // ttcf
static constexpr uint32_t kZipTag        = 0x504B0304; // PK\x03\x04
static constexpr uint32_t kWOFFTag       = 0x774F4646; // wOFF
static constexpr uint32_t kWOFF2Tag      = 0x774F4632; // wOF2
static constexpr uint32_t kHeadMagic     = 0x5F0F3CF5;
static constexpr uint16_t kMaximumTables = 512;
// Real fonts have a handful of axes and a few dozen instances; more is a damaged table.
static constexpr uint16_t kMaximumAxes      = 64;
static constexpr uint16_t kMaximumInstances = 256;
static constexpr uint16_t kNoName           = 0xFFFF;

static std::optional<uint32_t> readU32(std::string_view data, size_t offset)
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

static std::optional<uint16_t> readU16(std::string_view data, size_t offset)
{
    if (offset > data.size() || data.size() - offset < 2)
    {
        return std::nullopt;
    }
    return static_cast<uint16_t>((static_cast<uint8_t>(data[offset]) << 8) |
                                 static_cast<uint8_t>(data[offset + 1]));
}

FontFileType sniffFontFile(std::string_view head)
{
    switch (readU32(head, 0).value_or(0))
    {
        case kTrueTypeTag:
        case kAppleTrueType:
            return FontFileType::TrueType;
        case kOpenTypeTag:
            return FontFileType::OpenType;
        case kCollectionTag:
            return FontFileType::Collection;
        case kZipTag:
            return FontFileType::Zip;
        case kWOFFTag:
        case kWOFF2Tag:
            return FontFileType::WebFont;
        default:
            return FontFileType::Unknown;
    }
}

std::string fontFileExtension(FontFileType type)
{
    switch (type)
    {
        case FontFileType::TrueType:
            return "ttf";
        case FontFileType::OpenType:
            return "otf";
        case FontFileType::Collection:
            return "ttc";
        default:
            return "";
    }
}

struct Table {
    size_t offset = 0;
    size_t length = 0;
};

static std::optional<Table> findTable(std::string_view data, size_t font, uint32_t tag)
{
    const auto count = readU16(data, font + 4);
    for (uint16_t index = 0; count && index < std::min(*count, kMaximumTables); index++)
    {
        const size_t record = font + 12 + static_cast<size_t>(index) * 16;
        const auto   found  = readU32(data, record);
        const auto   offset = readU32(data, record + 8);
        const auto   length = readU32(data, record + 12);
        if (!found || !offset || !length)
        {
            return std::nullopt;
        }
        if (*found != tag)
        {
            continue;
        }
        if (*offset > data.size() || data.size() - *offset < *length)
        {
            return std::nullopt;
        }
        return Table{*offset, *length};
    }
    return std::nullopt;
}

static constexpr uint32_t tag(const char (&name)[5])
{
    return (static_cast<uint32_t>(name[0]) << 24) | (static_cast<uint32_t>(name[1]) << 16) |
           (static_cast<uint32_t>(name[2]) << 8) | static_cast<uint32_t>(name[3]);
}

static std::optional<size_t> firstFontOffset(std::string_view data)
{
    if (readU32(data, 0) != kCollectionTag)
    {
        return 0;
    }
    const auto count  = readU32(data, 8);
    const auto offset = readU32(data, 12);
    if (!count || *count == 0 || !offset)
    {
        return std::nullopt;
    }
    return *offset;
}

static int normalizedWeight(uint16_t weight)
{
    // Some old fonts store the 1-9 scale of the first OS/2 versions.
    const int scaled = weight > 0 && weight < 10 ? weight * 100 : weight;
    return scaled < 1 || scaled > 1000 ? 400 : scaled;
}

static std::string withoutSpaces(std::string text)
{
    text.erase(std::remove(text.begin(), text.end(), ' '), text.end());
    return text;
}

static double fixedValue(uint32_t value)
{
    return static_cast<int32_t>(value) / 65536.0;
}

// `wght`, or `ital` for a tag padded with spaces.
static std::string tagText(uint32_t value)
{
    std::string text;
    for (int shift = 24; shift >= 0; shift -= 8)
    {
        text += static_cast<char>((value >> shift) & 0xFF);
    }
    return text.substr(0, text.find_last_not_of(' ') + 1);
}

// Reads `fvar` into `face.axes` and `face.instances`; false for a table too damaged to trust.
static bool readVariations(const std::string &data, const Table &fvar, FontFace &face)
{
    const std::string_view table(data.data() + fvar.offset, fvar.length);
    const auto             axesOffset    = readU16(table, 4);
    const auto             axisCount     = readU16(table, 8);
    const auto             axisSize      = readU16(table, 10);
    const auto             instanceCount = readU16(table, 12);
    const auto             instanceSize  = readU16(table, 14);
    if (!axesOffset || !axisCount || !axisSize || !instanceCount || !instanceSize ||
        *axisCount == 0 || *axisCount > kMaximumAxes || *axisSize < 20 ||
        *instanceSize < 4 + *axisCount * 4)
    {
        return false;
    }

    for (uint16_t index = 0; index < *axisCount; index++)
    {
        const size_t record  = *axesOffset + static_cast<size_t>(index) * *axisSize;
        const auto   tag     = readU32(table, record);
        const auto   minimum = readU32(table, record + 4);
        const auto   value   = readU32(table, record + 8);
        const auto   maximum = readU32(table, record + 12);
        const auto   flags   = readU16(table, record + 16);
        const auto   nameID  = readU16(table, record + 18);
        if (!tag || !minimum || !value || !maximum || !flags || !nameID)
        {
            return false;
        }
        FontAxis axis{tagText(*tag),        "",
                      fixedValue(*minimum), fixedValue(*value),
                      fixedValue(*maximum), (*flags & 0x1) != 0};
        if (axis.tag.empty() || !(axis.minimum <= axis.defaultValue) ||
            !(axis.defaultValue <= axis.maximum))
        {
            return false;
        }
        axis.name = fontNameFromData(data, *nameID).value_or(axis.tag);
        face.axes.push_back(std::move(axis));
    }

    const size_t first = *axesOffset + static_cast<size_t>(*axisCount) * *axisSize;
    const bool   named = *instanceSize >= 6 + *axisCount * 4;
    for (uint16_t index = 0; index < std::min(*instanceCount, kMaximumInstances); index++)
    {
        const size_t record  = first + static_cast<size_t>(index) * *instanceSize;
        const auto   styleID = readU16(table, record);
        if (!styleID || record + *instanceSize > table.size())
        {
            break;
        }
        FontInstance instance;
        instance.style = fontNameFromData(data, *styleID).value_or("");
        for (size_t axis = 0; axis < face.axes.size(); axis++)
        {
            const double coordinate = fixedValue(*readU32(table, record + 4 + axis * 4));
            instance.coordinates[face.axes[axis].tag] =
                std::clamp(coordinate, face.axes[axis].minimum, face.axes[axis].maximum);
        }
        const auto psID = named ? readU16(table, record + 4 + face.axes.size() * 4) : std::nullopt;
        const auto psName = psID && *psID != kNoName ? fontNameFromData(data, *psID) : std::nullopt;
        instance.postScriptName =
            psName ? *psName : withoutSpaces(face.family) + "-" + withoutSpaces(instance.style);
        if (!instance.style.empty())
        {
            face.instances.push_back(std::move(instance));
        }
    }
    return true;
}

std::optional<FontFace> readFontFace(const std::string &data, std::string &error)
{
    const FontFileType type = sniffFontFile(data);
    if (type == FontFileType::WebFont)
    {
        error = "WOFF and WOFF2 fonts must be decoded first";
        return std::nullopt;
    }
    const auto font = fontFileExtension(type).empty() ? std::nullopt : firstFontOffset(data);
    const auto inner =
        font ? sniffFontFile(std::string_view(data).substr(std::min(*font, data.size())))
             : FontFileType::Unknown;
    if (inner != FontFileType::TrueType && inner != FontFileType::OpenType)
    {
        error = "The file is not a TrueType or OpenType font";
        return std::nullopt;
    }

    const auto head = findTable(data, *font, tag("head"));
    if (!head || head->length < 54 || readU32(data, head->offset + 12) != kHeadMagic ||
        !findTable(data, *font, tag("cmap")) || !findTable(data, *font, tag("name")) ||
        !(findTable(data, *font, tag("glyf")) || findTable(data, *font, tag("CFF ")) ||
          findTable(data, *font, tag("CFF2"))))
    {
        error = "The font is missing tables it needs";
        return std::nullopt;
    }

    const auto names = fontNamesFromData(data);
    if (!names || (!names->postScript && !names->full))
    {
        error = "The font has no name";
        return std::nullopt;
    }

    FontFace face;
    face.fullName       = names->full ? *names->full : *names->postScript;
    face.postScriptName = names->postScript.value_or(withoutSpaces(face.fullName));
    face.family         = names->family.value_or(face.fullName);

    const auto macStyle = readU16(data, head->offset + 44).value_or(0);
    face.italic         = (macStyle & 0x2) != 0;
    if (const auto os2 = findTable(data, *font, tag("OS/2")); os2 && os2->length >= 64)
    {
        face.weight              = normalizedWeight(readU16(data, os2->offset + 4).value_or(400));
        const auto selection     = readU16(data, os2->offset + 62).value_or(0);
        const bool italicOrSlant = (selection & 0x1) != 0 || (selection & 0x200) != 0;
        face.italic              = face.italic || italicOrSlant;
    }
    if (const auto fvar = findTable(data, *font, tag("fvar"));
        fvar && !readVariations(data, *fvar, face))
    {
        error = "The variable font's axes are damaged";
        return std::nullopt;
    }
    return face;
}

bool isContainedArchivePath(std::string_view name)
{
    if (name.empty() || name.front() == '/' || name.find('\\') != std::string_view::npos ||
        name.find('\0') != std::string_view::npos || name.find(':') != std::string_view::npos)
    {
        return false;
    }
    size_t start = 0;
    while (start <= name.size())
    {
        const size_t           end     = std::min(name.find('/', start), name.size());
        const std::string_view segment = name.substr(start, end - start);
        if (segment == "..")
        {
            return false;
        }
        start = end + 1;
    }
    return true;
}

static std::string lowercase(std::string_view text)
{
    std::string lower(text);
    std::transform(lower.begin(), lower.end(), lower.begin(), [](unsigned char character) {
        return static_cast<char>(std::tolower(character));
    });
    return lower;
}

static bool isFontEntry(std::string_view name)
{
    const size_t           slash = name.find_last_of('/');
    const std::string_view file  = slash == std::string_view::npos ? name : name.substr(slash + 1);
    // macOS zips carry `__MACOSX/._Name.ttf` resource forks that only look like fonts.
    if (file.starts_with("._") || name.starts_with("__MACOSX/"))
    {
        return false;
    }
    const std::string lower = lowercase(file);
    return lower.ends_with(".ttf") || lower.ends_with(".otf") || lower.ends_with(".woff") ||
           lower.ends_with(".woff2");
}

static ArchiveContents archiveError(std::string message)
{
    return {{}, std::move(message)};
}

ArchiveContents extractFontArchive(const std::string &zip, const ArchiveLimits &limits)
{
    mz_zip_archive archive{};
    if (!mz_zip_reader_init_mem(&archive, zip.data(), zip.size(), 0))
    {
        return archiveError("The archive is not a valid zip");
    }

    struct Entry {
        mz_uint     index;
        std::string name;
        size_t      size;
    };
    std::vector<Entry> entries;
    std::string        error;
    size_t             total = 0;
    const mz_uint      count = mz_zip_reader_get_num_files(&archive);
    if (count > limits.maxEntries)
    {
        error = "The archive has too many files";
    }
    for (mz_uint index = 0; error.empty() && index < count; index++)
    {
        mz_zip_archive_file_stat stat;
        if (!mz_zip_reader_file_stat(&archive, index, &stat))
        {
            error = "The archive is damaged";
            break;
        }
        if (!isContainedArchivePath(stat.m_filename))
        {
            error = "The archive has a file outside itself";
            break;
        }
        if (stat.m_is_directory || !isFontEntry(stat.m_filename) || stat.m_uncomp_size == 0)
        {
            continue;
        }
        if (stat.m_uncomp_size > limits.maxEntryBytes ||
            stat.m_uncomp_size > limits.maxTotalBytes - total)
        {
            error = "The archive unpacks to more than the font size limit";
            break;
        }
        if (entries.size() == limits.maxFonts)
        {
            error = "The archive has too many fonts";
            break;
        }
        total += static_cast<size_t>(stat.m_uncomp_size);
        entries.push_back({index, stat.m_filename, static_cast<size_t>(stat.m_uncomp_size)});
    }

    ArchiveContents contents;
    for (const Entry &entry : entries)
    {
        if (!error.empty())
        {
            break;
        }
        std::string data(entry.size, '\0');
        // Inflates into exactly the size the directory declared; a longer stream fails here.
        if (!mz_zip_reader_extract_to_mem(&archive, entry.index, data.data(), data.size(), 0))
        {
            continue;
        }
        contents.fonts.push_back({entry.name, std::move(data)});
    }
    mz_zip_reader_end(&archive);

    if (!error.empty())
    {
        return archiveError(std::move(error));
    }
    if (contents.fonts.empty())
    {
        contents.error = "The archive has no .ttf, .otf, .woff or .woff2 font";
    }
    return contents;
}
}
