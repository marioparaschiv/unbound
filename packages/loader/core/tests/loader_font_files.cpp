#include <cassert>
#include <string>

#include "FontFixtures.h"
#include "FontVectors.h"
#include "LoaderFontFiles.h"

using namespace loader::fonts;
using font_fixtures::FaceSpec;

static void sniffsByMagicBytes()
{
    assert(sniffFontFile(std::string("\x00\x01\x00\x00", 4)) == FontFileType::TrueType);
    assert(sniffFontFile("true") == FontFileType::TrueType);
    assert(sniffFontFile("OTTO") == FontFileType::OpenType);
    assert(sniffFontFile("ttcf") == FontFileType::Collection);
    assert(sniffFontFile("PK\x03\x04") == FontFileType::Zip);
    assert(sniffFontFile("wOF2") == FontFileType::WebFont);
    assert(sniffFontFile("<!DOCTYPE html>") == FontFileType::Unknown);
    assert(sniffFontFile("PK") == FontFileType::Unknown);
    assert(sniffFontFile("") == FontFileType::Unknown);
}

static void readsFaces()
{
    std::string error;
    const auto  regular = readFontFace(font_fixtures::font(), error);
    assert(regular && regular->postScriptName == "TestSans-Regular");
    assert(regular->family == "Test Sans" && regular->fullName == "Test Sans Regular");
    assert(regular->weight == 400 && !regular->italic);

    FaceSpec bold;
    bold.weight     = 700;
    bold.italic     = true;
    bold.openType   = true;
    bold.postScript = "TestSans-BoldItalic";
    const auto face = readFontFace(font_fixtures::font(bold), error);
    assert(face && face->weight == 700 && face->italic);

    FaceSpec legacy;
    legacy.weight = 7;
    assert(readFontFace(font_fixtures::font(legacy), error)->weight == 700);

    FaceSpec bare;
    bare.withOS2 = false;
    assert(readFontFace(font_fixtures::font(bare), error)->weight == 400);

    const auto first = readFontFace(font_fixtures::collection(font_fixtures::font(bold)), error);
    assert(first && first->postScriptName == "TestSans-BoldItalic");
}

static void readsVariableFonts()
{
    std::string error;
    const auto  font = readFontFace(font_vectors::variable(), error);
    assert(font && font->postScriptName == "VectorSans-Regular" && font->family == "Vector Sans");
    assert(font->axes.size() == 2 && font->variations.empty());
    assert(font->axes[0].tag == "wght" && font->axes[0].name == "Weight");
    assert(font->axes[0].minimum == 100 && font->axes[0].defaultValue == 400 &&
           font->axes[0].maximum == 900 && !font->axes[0].hidden);
    assert(font->axes[1].tag == "wdth" && font->axes[1].minimum == 75);

    assert(font->instances.size() == 3);
    // Regular has no PostScript name of its own, so it is built from the family and style.
    assert(font->instances[0].postScriptName == "VectorSans-Regular");
    assert(font->instances[1].postScriptName == "VectorSans-Bold");
    assert(font->instances[1].style == "Bold" && font->instances[1].coordinates.at("wght") == 700);
    assert(font->instances[2].postScriptName == "VectorSans-Condensed");
    assert(font->instances[2].coordinates.at("wdth") == 75);
}

static void refusesWhatIsNotAFont()
{
    std::string error;
    FaceSpec    variable;
    variable.variable = true;
    assert(!readFontFace(font_fixtures::font(variable), error));
    assert(error.find("axes are damaged") != std::string::npos);

    assert(!readFontFace("wOFF" + std::string(64, '\0'), error));
    assert(error.find("decoded first") != std::string::npos);
    assert(!readFontFace("<html><body>Not found</body></html>", error));
    assert(!readFontFace(font_fixtures::font().substr(0, 40), error));
    assert(!readFontFace(std::string("\x00\x01\x00\x00\xFF\xFF", 6), error));
    assert(!readFontFace("ttcf" + std::string(12, '\xFF'), error));
}

static void checksArchivePaths()
{
    assert(isContainedArchivePath("Font.ttf"));
    assert(isContainedArchivePath("fonts/Font.ttf"));
    assert(isContainedArchivePath("a..b/Font.ttf"));
    assert(!isContainedArchivePath("../Font.ttf"));
    assert(!isContainedArchivePath("fonts/../../Font.ttf"));
    assert(!isContainedArchivePath("/etc/Font.ttf"));
    assert(!isContainedArchivePath("fonts\\..\\Font.ttf"));
    assert(!isContainedArchivePath("C:Font.ttf"));
    assert(!isContainedArchivePath(""));
}

static void extractsFontsFromZips()
{
    FaceSpec bold;
    bold.postScript            = "TestSans-Bold";
    bold.weight                = 700;
    const std::string zipped   = font_fixtures::zip({
        {"Test Sans/TestSans-Regular.ttf", font_fixtures::font()},
        {"Test Sans/TestSans-Bold.OTF", font_fixtures::font(bold)},
        {"Test Sans/readme.txt", "hello"},
        {"__MACOSX/Test Sans/._TestSans-Regular.ttf", "resource fork"},
        {"Test Sans/", ""},
    });
    ArchiveContents   contents = extractFontArchive(zipped);
    assert(contents.error.empty());
    assert(contents.fonts.size() == 2);
    assert(contents.fonts[0].data == font_fixtures::font());
    assert(contents.fonts[1].name == "Test Sans/TestSans-Bold.OTF");

    assert(extractFontArchive(font_fixtures::zip({{"../evil.ttf", "x"}})).error.find("outside") !=
           std::string::npos);
    assert(extractFontArchive(font_fixtures::zip({{"notes.txt", "x"}})).error.find("no .ttf") !=
           std::string::npos);
    assert(!extractFontArchive("PK\x03\x04 not really").error.empty());
    assert(!extractFontArchive("<html>").error.empty());
}

static void boundsWhatArchivesUnpackTo()
{
    // The directory claims 1 GB: refused before anything inflates.
    const std::string bomb =
        font_fixtures::zip({{"Bomb.ttf", font_fixtures::font(), 1024u * 1024u * 1024u}});
    assert(extractFontArchive(bomb).error.find("size limit") != std::string::npos);

    ArchiveLimits small;
    small.maxEntryBytes = 64;
    assert(!extractFontArchive(font_fixtures::zip({{"A.ttf", font_fixtures::font()}}), small)
                .error.empty());

    ArchiveLimits total;
    total.maxTotalBytes = font_fixtures::font().size() + 10;
    assert(!extractFontArchive(font_fixtures::zip({{"A.ttf", font_fixtures::font()},
                                                   {"B.ttf", font_fixtures::font()}}),
                               total)
                .error.empty());

    ArchiveLimits few;
    few.maxEntries = 1;
    assert(extractFontArchive(font_fixtures::zip({{"A.ttf", "a"}, {"B.txt", "b"}}), few)
               .error.find("too many") != std::string::npos);

    // A declared size smaller than the stored bytes fails that entry's inflate, not the bounds.
    const ArchiveContents lying =
        extractFontArchive(font_fixtures::zip({{"Short.ttf", font_fixtures::font(), 8}}));
    assert(lying.fonts.empty());

    const std::string body     = font_fixtures::font();
    const auto        inflated = extractFontArchive(
        font_fixtures::zip({{"Deflated.ttf", body, static_cast<uint32_t>(body.size())}}));
    assert(inflated.fonts.size() == 1 && inflated.fonts[0].data == body);
}

int main()
{
    sniffsByMagicBytes();
    readsFaces();
    readsVariableFonts();
    refusesWhatIsNotAFont();
    checksArchivePaths();
    extractsFontsFromZips();
    boundsWhatArchivesUnpackTo();
    return 0;
}
