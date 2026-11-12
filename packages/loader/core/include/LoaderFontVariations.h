#pragma once

#include <optional>
#include <set>
#include <string>
#include <tuple>
#include <vector>

#include "LoaderFontFiles.h"

// The faces a variable font installs as: its named instances, a weight someone picked, or any
// coordinates along its axes. Each face is the same file drawn at its own coordinates.
namespace loader::fonts {
// A weight and style someone asked to install, such as 700 italic.
struct FontVariant {
    int  weight;
    bool italic;

    bool operator<(const FontVariant &other) const
    {
        return std::tie(weight, italic) < std::tie(other.weight, other.italic);
    }
};

// Every axis of `axes` at the coordinate `wanted` gives it, clamped to its range, or its default.
// Returns `std::nullopt` and sets `error` when `wanted` names an axis the font lacks.
std::optional<FontVariations> instanceCoordinates(const std::vector<FontAxis> &axes,
                                                  const FontVariations &wanted, std::string &error);

// `font` drawn at `coordinates`: a named instance's names when one sits there, else names built
// from the coordinates, such as `Inter-wght450`; the weight and style follow `wght`, `ital` and
// `slnt`.
FontFace instanceFace(const FontFace &font, const FontVariations &coordinates);

// The faces to install from variable `font`: one per variant in `wanted` that its axes reach,
// else its named instances, else its default.
std::vector<FontFace> variableFaces(const FontFace                             &font,
                                    const std::optional<std::set<FontVariant>> &wanted);
}
