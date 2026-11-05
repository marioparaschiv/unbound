#include <cassert>
#include <filesystem>
#include <fstream>
#include <string>

#include "FontFixtures.h"
#include "LoaderFiles.h"
#include "LoaderFontStore.h"

namespace fs = std::filesystem;
using namespace loader::fonts;

static void write(const fs::path &path, const std::string &contents)
{
    fs::create_directories(path.parent_path());
    std::ofstream(path, std::ios::binary) << contents;
}

static std::string staged(FontStore &store, const std::string &file, const std::string &data)
{
    const std::string directory = store.stagingDirectory();
    write(fs::path(directory) / file, data);
    return directory;
}

static InstalledFont face(const std::string &id, int weight, bool italic = false,
                          const std::string &family = "Inter")
{
    return {id,          family,
            id,          id,
            weight,      italic,
            id + ".ttf", FontSource{"google", family, weight, italic ? "italic" : "normal"}};
}

static void migratesTheOldFolderOnce(const fs::path &root)
{
    font_fixtures::FaceSpec spec;
    spec.postScript = "Old-Regular";
    spec.full       = "Old Regular";
    write(root / "Fonts" / "Old.ttf", font_fixtures::font(spec));
    write(root / "Fonts" / "page.ttf", "<html>");

    FontStore store(root.string());
    store.open({{"ggsans-Normal", "Old Regular"}, {"ggsans-Bold", "Helvetica"}});
    FontState state = store.state();
    assert(state.fonts.size() == 1);
    assert(state.fonts[0].id == "Old-Regular" && state.fonts[0].file == "Old.ttf");
    assert(state.fonts[0].source.local() && state.fonts[0].source.id == "Old-Regular");
    // A system font name has no installed face to point at, so it is dropped.
    assert(state.overrides ==
           (std::map<std::string, std::string>{{"ggsans-Normal", "Old-Regular"}}));
    assert(fs::exists(root / "Fonts" / "state.json"));

    FontStore again(root.string());
    again.open({{"ggsans-Bold", "Old-Regular"}});
    assert(again.state().overrides.size() == 1 && !again.state().overrides.count("ggsans-Bold"));
}

static void installsReplacesAndRemoves(const fs::path &root)
{
    FontStore store(root.string());
    store.open(nlohmann::json::object());
    int changes = 0;
    store.setOnChange([&] {
        changes++;
    });

    const auto installed =
        store.commitInstall(staged(store, "Inter-Regular.ttf", "a"), {face("Inter-Regular", 400)});
    assert(installed[0].file.starts_with("files/") && changes == 1);
    const std::string first = store.pathOf(installed[0]);
    assert(loader::readTextFile(first) == "a");
    assert(!fs::exists(root / "Fonts" / ".staging") || fs::is_empty(root / "Fonts" / ".staging"));

    const auto again =
        store.commitInstall(staged(store, "Inter-Regular.ttf", "b"), {face("Inter-Regular", 400)});
    assert(store.state().fonts.size() == 1 && !fs::exists(first));
    assert(loader::readTextFile(store.pathOf(again[0])) == "b");

    assert(store.setOverride("ggsans-Normal", std::string("Inter-Regular")));
    assert(!store.setOverride("ggsans-Normal", std::string("Missing")));
    assert(store.overrideTarget("ggsans-Normal")->at("name") == "Inter-Regular");
    assert(store.overrideTargets()["ggsans-Normal"]["path"] == store.pathOf(again[0]));

    assert(store.remove("Inter-Regular") && !store.remove("Inter-Regular"));
    assert(store.state().overrides.empty() && !store.overrideTarget("ggsans-Normal"));
    assert(!fs::exists(store.pathOf(again[0])));
}

static void expandsGroupsByWeight(const fs::path &root)
{
    FontStore store(root.string());
    store.open(nlohmann::json::object());
    store.commitInstall(staged(store, "x", ""),
                        {face("Inter-Regular", 400), face("Inter-SemiBold", 600),
                         face("Inter-Bold", 700), face("Inter-Italic", 400, true),
                         face("Lobster", 400, false, "Lobster")});
    store.setFamilies(discordFamilies({{"PRIMARY_NORMAL", "ggsans-Normal"},
                                       {"PRIMARY_SEMIBOLD", "ggsans-Semibold"},
                                       {"PRIMARY_BOLD", "ggsans-Bold"},
                                       {"PRIMARY_EXTRABOLD", "ggsans-ExtraBold"},
                                       {"PRIMARY_NORMAL_ITALIC", "ggsans-NormalItalic"},
                                       {"CODE_NORMAL", "SourceCodePro-Regular"},
                                       {"DISPLAY_BOLD", "ggsans-Bold, NotoSans-Bold"}}));
    // Discord lists ggsans-Bold under DISPLAY too; PRIMARY must keep it.
    assert(store.families().at("ggsans-Bold").groups.size() == 2);

    assert(store.setOverride("PRIMARY", std::string("Inter-Regular")));
    const auto overrides = store.state().overrides;
    assert(overrides.at("ggsans-Normal") == "Inter-Regular");
    assert(overrides.at("ggsans-Semibold") == "Inter-SemiBold");
    assert(overrides.at("ggsans-Bold") == "Inter-Bold");
    assert(overrides.at("ggsans-ExtraBold") == "Inter-Bold");
    assert(overrides.at("ggsans-NormalItalic") == "Inter-Italic");
    assert(!overrides.count("SourceCodePro-Regular"));

    // One family alone takes exactly the face chosen.
    assert(store.setOverride("ggsans-Bold", std::string("Lobster")));
    assert(store.state().overrides.at("ggsans-Bold") == "Lobster");

    assert(store.setOverride("PRIMARY", std::nullopt));
    assert(store.state().overrides.empty());

    assert(store.setOverride("*", std::string("Lobster")));
    assert(store.overrideTarget("anything")->at("name") == "Lobster");
}

static void keepsPresets(const fs::path &root)
{
    FontStore  store(root.string());
    FontPreset preset{"", "My Fonts", {{"ggsans-Normal", {"google", "Inter", 400, "normal"}}}};
    store.open(nlohmann::json::object());
    const FontPreset saved  = store.savePreset(preset);
    const FontPreset second = store.savePreset(preset);
    assert(saved.id == "my-fonts" && second.id == "my-fonts-2");
    assert(store.state().presets.size() == 2);
    assert(store.removePreset("my-fonts-2") && !store.removePreset("my-fonts-2"));

    FontStore reopened(root.string());
    reopened.open(nlohmann::json::object());
    assert(reopened.state().presets.size() == 1);
    assert(reopened.state().presets[0].overrides.at("ggsans-Normal").weight == 400);
}

int main()
{
    const fs::path base  = fs::temp_directory_path() / "unbound-font-store";
    int            case_ = 0;
    for (auto test : {migratesTheOldFolderOnce, installsReplacesAndRemoves, expandsGroupsByWeight,
                      keepsPresets})
    {
        const fs::path root = base / std::to_string(case_++);
        fs::remove_all(root);
        test(root);
    }
    fs::remove_all(base);
    return 0;
}
