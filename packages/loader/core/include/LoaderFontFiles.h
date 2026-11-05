#pragma once

#include <cstddef>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace loader::fonts {
// The largest font or archive a download may be, and the most one archive may unpack to.
constexpr size_t kMaxFontDownloadBytes = 10 * 1024 * 1024;

enum class FontFileType
{
    TrueType,
    OpenType,
    Collection,
    Zip,
    WebFont,
    Unknown
};

// Reads what a downloaded file is from its first bytes, never its name or Content-Type: a bad
// provider slug answers with an HTML page.
FontFileType sniffFontFile(std::string_view head);

// The extension a font of `type` is saved with; empty for a type that is not a font.
std::string fontFileExtension(FontFileType type);

// One face read from a font file: its names, and the weight and style it declares itself.
struct FontFace {
    std::string postScriptName;
    std::string fullName;
    std::string family;
    int         weight = 400;
    bool        italic = false;
};

// Checks `data` is a usable static TrueType or OpenType font (index 0 of a collection) and reads
// its face. Returns `std::nullopt` and sets `error` for anything else, variable fonts included.
std::optional<FontFace> readFontFace(const std::string &data, std::string &error);

struct ArchiveLimits {
    size_t maxEntries    = 256;
    size_t maxFonts      = 64;
    size_t maxEntryBytes = kMaxFontDownloadBytes;
    size_t maxTotalBytes = 4 * kMaxFontDownloadBytes;
};

struct ArchiveFont {
    std::string name;
    std::string data;
};

// The `.ttf` and `.otf` entries of a zip. Fails the whole archive on a path that leaves it, or on
// an entry or total size past `limits`, read from the directory before anything inflates.
struct ArchiveContents {
    std::vector<ArchiveFont> fonts;
    std::string              error;
};

ArchiveContents extractFontArchive(const std::string &zip, const ArchiveLimits &limits = {});

// Whether a zip entry name stays inside the archive: relative, no `..` segment, no backslash.
bool isContainedArchivePath(std::string_view name);
}
