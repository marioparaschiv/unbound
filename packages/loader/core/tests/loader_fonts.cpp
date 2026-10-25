#include "LoaderFonts.h"

#include <cassert>
#include <filesystem>
#include <string>

static void appendU16(std::string &data, uint16_t value)
{
    data += static_cast<char>(value >> 8);
    data += static_cast<char>(value & 0xFF);
}

static void appendU32(std::string &data, uint32_t value)
{
    appendU16(data, static_cast<uint16_t>(value >> 16));
    appendU16(data, static_cast<uint16_t>(value & 0xFFFF));
}

static std::string syntheticFont(const std::string &fullName)
{
    std::string name;
    for (char character : fullName)
    {
        appendU16(name, static_cast<uint16_t>(character));
    }

    std::string font;
    appendU32(font, 0x00010000);
    appendU16(font, 1);
    appendU16(font, 16);
    appendU16(font, 0);
    appendU16(font, 0);
    appendU32(font, 0x6E616D65);
    appendU32(font, 0);
    appendU32(font, 28);
    appendU32(font, static_cast<uint32_t>(18 + name.size()));

    appendU16(font, 0);
    appendU16(font, 1);
    appendU16(font, 18);
    appendU16(font, 3);
    appendU16(font, 1);
    appendU16(font, 0x409);
    appendU16(font, 4);
    appendU16(font, static_cast<uint16_t>(name.size()));
    appendU16(font, 0);
    return font + name;
}

int main()
{
    assert(loader::fontFullNameFromData(syntheticFont("Parity Sans Bold")) ==
           std::optional<std::string>("Parity Sans Bold"));
    assert(!loader::fontFullNameFromData("not a font"));
    assert(!loader::fontFullNameFromData(""));

    const std::string arial = "/System/Library/Fonts/Supplemental/Arial.ttf";
    if (std::filesystem::exists(arial))
    {
        assert(loader::fontFullName(arial) == std::optional<std::string>("Arial"));
    }

    nlohmann::json overrides = {{"*", "Ginto"}, {"Whitney", "Arial"}};
    assert(loader::fontOverrideFor(overrides, "Whitney") == std::optional<std::string>("Ginto"));
    overrides.erase("*");
    assert(loader::fontOverrideFor(overrides, "Whitney") == std::optional<std::string>("Arial"));
    assert(!loader::fontOverrideFor(overrides, "Other"));
    assert(!loader::fontOverrideFor(nlohmann::json::array(), "Whitney"));
    return 0;
}
