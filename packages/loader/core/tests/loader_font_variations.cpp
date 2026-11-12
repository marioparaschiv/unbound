#include <cassert>
#include <string>

#include "FontVectors.h"
#include "LoaderFontVariations.h"

using namespace loader::fonts;

static FontFace vectorSans()
{
    std::string error;
    return *readFontFace(font_vectors::variable(), error);
}

static void fillsAndClampsCoordinates()
{
    const FontFace font = vectorSans();
    std::string    error;
    assert((instanceCoordinates(font.axes, {{"wght", 450}}, error) ==
            FontVariations{{"wght", 450}, {"wdth", 100}}));
    assert((instanceCoordinates(font.axes, {{"wght", 2000}, {"wdth", 0}}, error) ==
            FontVariations{{"wght", 900}, {"wdth", 75}}));
    assert(!instanceCoordinates(font.axes, {{"opsz", 12}}, error));
    assert(error.find("opsz") != std::string::npos);
}

static void namesInstances()
{
    const FontFace font = vectorSans();
    const FontFace bold = instanceFace(font, {{"wght", 700}, {"wdth", 100}});
    assert(bold.postScriptName == "VectorSans-Bold" && bold.fullName == "Vector Sans Bold");
    assert(bold.weight == 700 && !bold.italic && bold.instances.empty());
    assert((bold.variations == FontVariations{{"wght", 700}, {"wdth", 100}}));

    const FontFace custom = instanceFace(font, {{"wght", 450.5}, {"wdth", 87.25}});
    assert(custom.postScriptName == "VectorSans-wght450.5wdth87.25");
    assert(custom.fullName == "Vector Sans Weight 450.5, Width 87.25");
    assert(custom.weight == 451 && custom.axes.size() == 2);
}

static void followsItalicAndSlantAxes()
{
    FontFace font;
    font.family = "Slanted";
    font.axes   = {{"wght", "Weight", 100, 400, 900}, {"slnt", "Slant", -10, 0, 0}};
    assert(instanceFace(font, {{"wght", 400}, {"slnt", -10}}).italic);
    assert(!instanceFace(font, {{"wght", 400}, {"slnt", 0}}).italic);

    std::vector<FontFace> faces = variableFaces(font, std::set<FontVariant>{{700, true}});
    assert(faces.size() == 1 && faces[0].italic && faces[0].variations.at("slnt") == -10);

    font.axes = {{"ital", "Italic", 0, 0, 1}};
    faces     = variableFaces(font, std::set<FontVariant>{{400, true}, {400, false}});
    assert(faces.size() == 2 && !faces[0].italic && faces[1].italic);
}

static void expandsIntoFaces()
{
    const FontFace font  = vectorSans();
    auto           named = variableFaces(font, std::nullopt);
    assert(named.size() == 3);
    assert(named[0].postScriptName == "VectorSans-Regular" && named[0].weight == 400);
    assert(named[1].postScriptName == "VectorSans-Bold" && named[1].weight == 700);
    assert(named[2].postScriptName == "VectorSans-Condensed");

    // Any weight the axis reaches; past it, or italic the font cannot draw, installs nothing.
    const auto picked = variableFaces(
        font, std::set<FontVariant>{{300, false}, {700, false}, {950, false}, {400, true}});
    assert(picked.size() == 2);
    assert(picked[0].postScriptName == "VectorSans-wght300" && picked[0].weight == 300);
    assert(picked[1].postScriptName == "VectorSans-Bold");

    FontFace bare = font;
    bare.instances.clear();
    const auto fallback = variableFaces(bare, std::nullopt);
    assert(fallback.size() == 1 && fallback[0].postScriptName == "VectorSans-Regular");
}

int main()
{
    fillsAndClampsCoordinates();
    namesInstances();
    followsItalicAndSlantAxes();
    expandsIntoFaces();
    return 0;
}
