#include "LoaderFonts.h"

#include <cassert>
#include <filesystem>
#include <fstream>
#include <string>
#include <vector>

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

static std::string utf16(const std::string &text)
{
    std::string encoded;
    for (char character : text)
    {
        appendU16(encoded, static_cast<uint16_t>(character));
    }
    return encoded;
}

static std::string syntheticFont(const std::string &fullName, const std::string &postScriptName = "",
                                 const std::string &family = "")
{
    struct Record
    {
        uint16_t    id;
        std::string text;
    };
    std::vector<Record> records = {{4, utf16(fullName)}};
    if (!postScriptName.empty())
    {
        records.push_back({6, utf16(postScriptName)});
    }
    if (!family.empty())
    {
        records.push_back({1, utf16(family)});
    }

    const uint16_t storage = static_cast<uint16_t>(6 + records.size() * 12);
    std::string    strings;
    std::string    table;
    appendU16(table, 0);
    appendU16(table, static_cast<uint16_t>(records.size()));
    appendU16(table, storage);
    for (const Record &record : records)
    {
        appendU16(table, 3);
        appendU16(table, 1);
        appendU16(table, 0x409);
        appendU16(table, record.id);
        appendU16(table, static_cast<uint16_t>(record.text.size()));
        appendU16(table, static_cast<uint16_t>(strings.size()));
        strings += record.text;
    }
    table += strings;

    std::string font;
    appendU32(font, 0x00010000);
    appendU16(font, 1);
    appendU16(font, 16);
    appendU16(font, 0);
    appendU16(font, 0);
    appendU32(font, 0x6E616D65);
    appendU32(font, 0);
    appendU32(font, 28);
    appendU32(font, static_cast<uint32_t>(table.size()));
    return font + table;
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

    const auto directory = std::filesystem::temp_directory_path() / "loader-fonts-test";
    std::filesystem::create_directories(directory);
    const auto first  = (directory / "Parity-Bold.ttf").string();
    const auto second = (directory / "Parity-Copy.ttf").string();
    const auto broken = (directory / "Broken.ttf").string();
    std::ofstream(first, std::ios::binary) << syntheticFont("Parity Sans Bold");
    std::ofstream(second, std::ios::binary) << syntheticFont("Parity Sans Bold");
    std::ofstream(broken, std::ios::binary) << "nope";
    assert(loader::fontFullName(first) == std::optional<std::string>("Parity Sans Bold"));
    assert(!loader::fontFullName(broken));

    nlohmann::json system = loader::systemFontsFromFiles({second, first, broken}, "system");
    assert(system.size() == 1 && system[0]["name"] == "Parity Sans Bold" && system[0]["path"] == second);
    assert(system[0]["source"] == "system");

    const auto named = (directory / "ggsans-Bold.ttf").string();
    std::ofstream(named, std::ios::binary) << syntheticFont("gg sans Bold", "ggsans-Bold", "gg sans");
    auto names = loader::fontNames(named);
    assert(names && names->postScript == std::optional<std::string>("ggsans-Bold"));
    assert(names->family == std::optional<std::string>("gg sans"));
    nlohmann::json entry = loader::fontEntry(named, "app");
    assert(entry["name"] == "ggsans-Bold" && entry["displayName"] == "gg sans Bold" && entry["family"] == "gg sans");
    assert(loader::resolveFontTarget(nlohmann::json::array(), nlohmann::json::array({entry}), "gg sans Bold")->name ==
           "ggsans-Bold");

    nlohmann::json fromData = loader::fontEntryFromData(syntheticFont("gg sans Bold", "ggsans-Bold", "gg sans"),
                                                        "asset:fonts/ggsans-Bold.ttf", "app", "ggsans-Bold");
    assert(fromData["name"] == "ggsans-Bold" && fromData["displayName"] == "gg sans Bold" && fromData["source"] == "app");
    nlohmann::json opaque = loader::fontEntryFromData("nope", "asset:fonts/x.ttf", "app", "x");
    assert(opaque["name"] == "x" && opaque["displayName"] == "x");

    nlohmann::json catalog =
        loader::fontCatalog(nlohmann::json::array({entry}), nlohmann::json::array({entry, "Helvetica"}));
    assert(catalog.size() == 2 && catalog[1]["name"] == "Helvetica");
    assert(loader::fontNamesOf(catalog) == nlohmann::json::array({"ggsans-Bold", "Helvetica"}));

    nlohmann::json custom = nlohmann::json::array({{{"name", "Ginto"}, {"path", "/fonts/Ginto.otf"}}});
    auto ginto = loader::resolveFontTarget(custom, system, "Ginto");
    assert(ginto && ginto->path == std::optional<std::string>("/fonts/Ginto.otf"));
    auto parity = loader::resolveFontTarget(custom, system, "Parity Sans Bold");
    assert(parity && parity->path == std::optional<std::string>(second));
    auto family = loader::resolveFontTarget(custom, nlohmann::json::array({"Helvetica Neue"}), "Helvetica Neue");
    assert(family && family->name == "Helvetica Neue" && !family->path);
    assert(!loader::resolveFontTarget(custom, system, "Missing"));
    assert(!loader::resolveFontTarget(custom, system, ""));
    assert(loader::fontUnavailableMessage("Whitney", "Missing") ==
           "Failed to replace \"Whitney\" with \"Missing\". The requested font isn't loaded.");

    std::filesystem::remove_all(directory);
    return 0;
}
