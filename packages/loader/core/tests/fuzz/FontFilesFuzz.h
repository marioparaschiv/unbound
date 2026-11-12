#pragma once

// One fuzz input through everything that reads untrusted font bytes: the sniffer, the face reader,
// the zip reader and the preset and state parsers. Shared by the ctest run and libFuzzer.

#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <string>

#include "LoaderFontFiles.h"
#include "LoaderFontState.h"
#include "LoaderFontVariations.h"
#include "LoaderJSON.h"

namespace font_files_fuzz {
inline void require(bool condition, const char *invariant)
{
    if (!condition)
    {
        std::fprintf(stderr, "font files fuzz invariant broken: %s\n", invariant);
        std::abort();
    }
}

inline void fuzzOne(const uint8_t *data, size_t size)
{
    const std::string input(reinterpret_cast<const char *>(data), size);
    using namespace loader::fonts;

    loader::fonts::sniffFontFile(input);
    std::string error;
    if (const auto face = readFontFace(input, error))
    {
        require(!face->postScriptName.empty(), "a read face has a PostScript name");
        require(face->weight >= 1 && face->weight <= 1000, "a read weight is in range");
        require(!fontIdFor(face->postScriptName).empty(), "every face gets an id");
        for (const FontFace &instance :
             face->axes.empty() ? std::vector<FontFace>{} : variableFaces(*face, std::nullopt))
        {
            for (const FontAxis &axis : face->axes)
            {
                const double value = instance.variations.at(axis.tag);
                require(value >= axis.minimum && value <= axis.maximum,
                        "an instance stays inside its axes");
            }
        }
    }
    else
    {
        require(!error.empty(), "a refused font says why");
    }

    error.clear();
    if (const auto decoded = decodeWebFont(input, error))
    {
        require(decoded->size() <= kMaxDecodedFontBytes, "a decoded font stays under the limit");
        readFontFace(*decoded, error);
    }
    else
    {
        require(!error.empty(), "a refused web font says why");
    }

    ArchiveLimits limits;
    limits.maxEntryBytes          = 1 << 16;
    limits.maxTotalBytes          = 1 << 18;
    limits.maxFonts               = 8;
    const ArchiveContents archive = extractFontArchive(input, limits);
    size_t                total   = 0;
    for (const ArchiveFont &font : archive.fonts)
    {
        require(isContainedArchivePath(font.name), "an extracted name stays in the archive");
        require(font.data.size() <= limits.maxEntryBytes, "an entry stays under its limit");
        total += font.data.size();
    }
    require(total <= limits.maxTotalBytes && archive.fonts.size() <= limits.maxFonts,
            "an archive stays under its limits");
    require(archive.fonts.empty() || archive.error.empty(), "a failed archive yields no fonts");

    const nlohmann::json json = loader::parseBoundedJSON(input);
    std::string          presetError;
    if (const auto preset = parseFontPreset(json, presetError))
    {
        require(parseFontPreset(fontPresetJSON(*preset), presetError).has_value(),
                "a valid preset survives its own JSON");
    }
    const FontState state = parseFontState(json);
    require(parseFontState(fontStateJSON(state)).fonts.size() == state.fonts.size(),
            "a parsed state survives its own JSON");
    discordFamilies(json);
}
}
