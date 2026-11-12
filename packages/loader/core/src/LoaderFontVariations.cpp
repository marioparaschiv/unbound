#include "LoaderFontVariations.h"

#include <algorithm>
#include <cmath>

namespace loader::fonts {
// Coordinates closer than this are the same instance; fonts store them as 16.16 fixed point.
static constexpr double kSameCoordinate = 0.01;

static const FontAxis *findAxis(const std::vector<FontAxis> &axes, const std::string &tag)
{
    const auto found = std::find_if(axes.begin(), axes.end(), [&](const FontAxis &axis) {
        return axis.tag == tag;
    });
    return found == axes.end() ? nullptr : &*found;
}

std::optional<FontVariations> instanceCoordinates(const std::vector<FontAxis> &axes,
                                                  const FontVariations &wanted, std::string &error)
{
    for (const auto &[tag, value] : wanted)
    {
        if (!findAxis(axes, tag) || !std::isfinite(value))
        {
            error = "The font has no " + tag + " axis";
            return std::nullopt;
        }
    }
    FontVariations coordinates;
    for (const FontAxis &axis : axes)
    {
        const auto   found    = wanted.find(axis.tag);
        const double value    = found == wanted.end() ? axis.defaultValue : found->second;
        coordinates[axis.tag] = std::clamp(value, axis.minimum, axis.maximum);
    }
    return coordinates;
}

static bool sameCoordinates(const FontVariations &left, const FontVariations &right)
{
    return left.size() == right.size() &&
           std::all_of(left.begin(), left.end(), [&](const auto &entry) {
               const auto other = right.find(entry.first);
               return other != right.end() &&
                      std::abs(other->second - entry.second) < kSameCoordinate;
           });
}

// `450`, `12.5` or `-10`: at most two decimals, no trailing zeros.
static std::string coordinateText(double value)
{
    std::string text = std::to_string(std::round(value * 100) / 100);
    text.erase(text.find_last_not_of('0') + 1);
    if (text.ends_with('.'))
    {
        text.pop_back();
    }
    return text == "-0" ? "0" : text;
}

static std::string withoutSpaces(std::string text)
{
    text.erase(std::remove(text.begin(), text.end(), ' '), text.end());
    return text;
}

FontFace instanceFace(const FontFace &font, const FontVariations &coordinates)
{
    FontFace face   = font;
    face.variations = coordinates;
    face.instances.clear();

    const auto value = [&](const char *tag) -> std::optional<double> {
        const auto found = coordinates.find(tag);
        return found == coordinates.end() ? std::nullopt : std::optional(found->second);
    };
    if (const auto weight = value("wght"))
    {
        face.weight = std::clamp(static_cast<int>(std::lround(*weight)), 1, 1000);
    }
    const auto italic = value("ital");
    const auto slant  = value("slnt");
    if (italic || slant)
    {
        face.italic = italic.value_or(0) >= 0.5 || std::abs(slant.value_or(0)) >= kSameCoordinate;
    }

    const auto named = std::find_if(font.instances.begin(), font.instances.end(),
                                    [&](const FontInstance &instance) {
                                        return sameCoordinates(instance.coordinates, coordinates);
                                    });
    if (named != font.instances.end())
    {
        face.postScriptName = named->postScriptName;
        face.fullName       = font.family + " " + named->style;
        return face;
    }

    std::string suffix;
    std::string label;
    for (const FontAxis &axis : font.axes)
    {
        const double coordinate =
            coordinates.count(axis.tag) ? coordinates.at(axis.tag) : axis.defaultValue;
        if (std::abs(coordinate - axis.defaultValue) < kSameCoordinate)
        {
            continue;
        }
        suffix += withoutSpaces(axis.tag) + coordinateText(coordinate);
        label += (label.empty() ? "" : ", ") + axis.name + " " + coordinateText(coordinate);
    }
    // The default coordinates draw the face the file names itself.
    if (!suffix.empty())
    {
        face.postScriptName = withoutSpaces(font.family) + "-" + suffix;
        face.fullName       = font.family + " " + label;
    }
    return face;
}

// The coordinates that draw `variant`, or `std::nullopt` when the axes cannot reach it.
static std::optional<FontVariations> variantCoordinates(const FontFace    &font,
                                                        const FontVariant &variant)
{
    std::string    error;
    FontVariations wanted;
    if (const FontAxis *weight = findAxis(font.axes, "wght"))
    {
        if (variant.weight < weight->minimum || variant.weight > weight->maximum)
        {
            return std::nullopt;
        }
        wanted["wght"] = variant.weight;
    }
    else if (variant.weight != font.weight)
    {
        return std::nullopt;
    }

    const FontAxis *italic = findAxis(font.axes, "ital");
    const FontAxis *slant  = findAxis(font.axes, "slnt");
    if (italic)
    {
        if (variant.italic ? italic->maximum < 1 : italic->minimum > 0)
        {
            return std::nullopt;
        }
        wanted["ital"] = variant.italic ? 1 : 0;
    }
    else if (slant)
    {
        // Slanted designs lean right with a negative angle.
        wanted["slnt"] =
            variant.italic ? slant->minimum : std::clamp(0.0, slant->minimum, slant->maximum);
        if (variant.italic && slant->minimum >= 0)
        {
            return std::nullopt;
        }
    }
    else if (variant.italic != font.italic)
    {
        return std::nullopt;
    }
    return instanceCoordinates(font.axes, wanted, error);
}

std::vector<FontFace> variableFaces(const FontFace                             &font,
                                    const std::optional<std::set<FontVariant>> &wanted)
{
    std::vector<FontFace> faces;
    const auto            add = [&](const FontVariations &coordinates) {
        FontFace face = instanceFace(font, coordinates);
        if (std::none_of(faces.begin(), faces.end(), [&](const FontFace &other) {
                return other.postScriptName == face.postScriptName;
            }))
        {
            faces.push_back(std::move(face));
        }
    };

    if (wanted)
    {
        for (const FontVariant &variant : *wanted)
        {
            if (const auto coordinates = variantCoordinates(font, variant))
            {
                add(*coordinates);
            }
        }
        return faces;
    }
    std::string error;
    for (const FontInstance &instance : font.instances)
    {
        if (const auto coordinates = instanceCoordinates(font.axes, instance.coordinates, error))
        {
            add(*coordinates);
        }
    }
    if (faces.empty())
    {
        add(*instanceCoordinates(font.axes, {}, error));
    }
    return faces;
}
}
