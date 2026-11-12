#include <cassert>
#include <string>

#include "FontFixtures.h"
#include "FontVectors.h"
#include "LoaderFontFiles.h"

using namespace loader::fonts;

static void decodesWOFF()
{
    std::string error;
    const auto  font = decodeWebFont(font_vectors::woff(), error);
    // WOFF only deflates each table, so the original font comes back, its tables in tag order.
    assert(font && font->size() == font_vectors::variable().size());
    const auto face = readFontFace(*font, error);
    assert(face && face->postScriptName == "VectorSans-Regular" && face->instances.size() == 3);
}

static void decodesWOFF2()
{
    std::string error;
    const auto  font = decodeWebFont(font_vectors::woff2(), error);
    assert(font && sniffFontFile(*font) == FontFileType::TrueType);
    const auto face = readFontFace(*font, error);
    assert(face && face->postScriptName == "VectorSans-Regular" && face->axes.size() == 2);
    assert(face->instances.size() == 3);
}

static uint32_t readU32(const std::string &data, size_t at)
{
    return (static_cast<uint32_t>(static_cast<uint8_t>(data[at])) << 24) |
           (static_cast<uint32_t>(static_cast<uint8_t>(data[at + 1])) << 16) |
           (static_cast<uint32_t>(static_cast<uint8_t>(data[at + 2])) << 8) |
           static_cast<uint8_t>(data[at + 3]);
}

static void decodesUncompressedTables()
{
    // A WOFF may store a table as it is when deflating would not shrink it.
    const std::string original = font_fixtures::font();
    const uint16_t    tables   = static_cast<uint16_t>(readU32(original, 4) >> 16);
    std::string       woff     = "wOFF";
    font_fixtures::appendU32(woff, 0x00010000);
    font_fixtures::appendU32(woff, 0);
    font_fixtures::appendU16(woff, tables);
    font_fixtures::appendU16(woff, 0);
    font_fixtures::appendU32(woff, static_cast<uint32_t>(original.size()));
    woff.append(24, '\0');
    std::string body;
    size_t      offset = 44 + tables * 20;
    for (uint16_t index = 0; index < tables; index++)
    {
        const size_t      record = 12 + index * 16;
        const std::string table =
            original.substr(readU32(original, record + 8), readU32(original, record + 12));
        woff += original.substr(record, 4);
        font_fixtures::appendU32(woff, static_cast<uint32_t>(offset + body.size()));
        font_fixtures::appendU32(woff, static_cast<uint32_t>(table.size()));
        font_fixtures::appendU32(woff, static_cast<uint32_t>(table.size()));
        font_fixtures::appendU32(woff, readU32(original, record + 4));
        body += table;
    }
    woff += body;

    std::string error;
    const auto  font = decodeWebFont(woff, error);
    assert(font);
    const auto face = readFontFace(*font, error);
    assert(face && face->postScriptName == "TestSans-Regular");
}

static void refusesDamagedFiles()
{
    std::string error;
    assert(!decodeWebFont(font_vectors::woff().substr(0, 60), error));
    assert(error.find("WOFF") != std::string::npos);
    assert(!decodeWebFont(font_vectors::woff2().substr(0, 60), error));
    assert(error.find("WOFF2") != std::string::npos);
    assert(!decodeWebFont(font_fixtures::font(), error));
    assert(!decodeWebFont("wOF2" + std::string(64, '\xFF'), error));

    // A header claiming a 4 GB font is refused before anything unpacks.
    std::string bomb = font_vectors::woff();
    bomb.replace(16, 4, "\xFF\xFF\xFF\xFF");
    assert(!decodeWebFont(bomb, error));

    // A table that inflates to less than its declared size.
    std::string truncated = font_vectors::woff();
    truncated[44 + 12]    = '\x7F';
    assert(!decodeWebFont(truncated, error));
}

int main()
{
    decodesWOFF();
    decodesWOFF2();
    decodesUncompressedTables();
    refusesDamagedFiles();
    return 0;
}
