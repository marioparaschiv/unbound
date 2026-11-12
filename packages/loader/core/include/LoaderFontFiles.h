#pragma once

#include <cstddef>
#include <map>
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

// The most a decoded WOFF or WOFF2 font may be: compression makes a 10 MB download larger.
constexpr size_t kMaxDecodedFontBytes = 3 * kMaxFontDownloadBytes;

// One design axis of a variable font, such as `wght` from 100 to 900.
struct FontAxis {
    std::string tag;
    std::string name;
    double      minimum      = 0;
    double      defaultValue = 0;
    double      maximum      = 0;
    // The font asks apps not to offer it, such as an optical size that follows the text size.
    bool hidden = false;
};

// Axis tag to coordinate, such as `{ wght: 700 }`; empty for a static face.
using FontVariations = std::map<std::string, double>;

// A variable font's named instance, such as `Bold` at `{ wght: 700 }`.
struct FontInstance {
    std::string    postScriptName;
    std::string    style;
    FontVariations coordinates;
};

// One face read from a font file: its names, the weight and style it declares itself, and for a
// variable font its axes, named instances and the coordinates this face draws at.
struct FontFace {
    std::string               postScriptName;
    std::string               fullName;
    std::string               family;
    int                       weight = 400;
    bool                      italic = false;
    std::vector<FontAxis>     axes;
    std::vector<FontInstance> instances;
    FontVariations            variations;
};

// Checks `data` is a usable TrueType or OpenType font, static or variable (index 0 of a
// collection), and reads its face. Returns `std::nullopt` and sets `error` for anything else;
// WOFF and WOFF2 must go through `decodeWebFont` first.
std::optional<FontFace> readFontFace(const std::string &data, std::string &error);

// Unpacks a WOFF or WOFF2 file into the TrueType or OpenType font it wraps. Returns
// `std::nullopt` and sets `error` for a damaged file or one past `kMaxDecodedFontBytes`.
std::optional<std::string> decodeWebFont(const std::string &data, std::string &error);

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

// The `.ttf`, `.otf`, `.woff` and `.woff2` entries of a zip. Fails the whole archive on a path that
// leaves it, or on an entry or total size past `limits`, read from the directory before anything
// inflates.
struct ArchiveContents {
    std::vector<ArchiveFont> fonts;
    std::string              error;
};

ArchiveContents extractFontArchive(const std::string &zip, const ArchiveLimits &limits = {});

// Whether a zip entry name stays inside the archive: relative, no `..` segment, no backslash.
bool isContainedArchivePath(std::string_view name);
}
