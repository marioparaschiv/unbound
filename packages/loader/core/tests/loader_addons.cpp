#include <cassert>
#include <filesystem>
#include <string>
#include <unistd.h>

#include "LoaderAddons.h"
#include "LoaderFiles.h"
#include "LoaderPreload.h"
#include "LoaderVersion.h"

static std::filesystem::path makeTemporaryDirectory()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-addons-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    return std::filesystem::path(directory);
}

static void write(const std::filesystem::path &path, const std::string &contents)
{
    assert(loader::writeTextFileAtomically(path.string(), contents));
}

int main()
{
    const auto root = makeTemporaryDirectory();

    write(root / "Plugins" / "good" / "manifest.json", R"({"id":"a.good","main":"index.js"})");
    write(root / "Plugins" / "good" / "index.js", "module.exports = 1;");
    write(root / "Plugins" / "missing-main" / "manifest.json", R"({"id":"a.missing"})");
    write(root / "Plugins" / "bad-manifest" / "manifest.json", "nope");
    write(root / "Plugins" / "stray-file", "x");

    nlohmann::json plugins = loader::scanPlugins(root.string());
    assert(plugins.size() == 1);
    assert(plugins[0]["manifest"]["id"] == "a.good");
    assert(plugins[0]["manifest"]["folder"] == "good");
    assert(plugins[0]["manifest"]["entry"] == (root / "Plugins" / "good" / "index.js").string());
    assert(plugins[0]["bundle"] == "module.exports = 1;");

    write(root / "Themes" / "dark" / "manifest.json", R"({"id":"t.dark"})");
    write(root / "Themes" / "dark" / "bundle.json", R"({"semantic":{}})");
    write(root / "Themes" / "no-bundle" / "manifest.json", R"({"id":"t.none"})");

    nlohmann::json themes = loader::scanThemes(root.string());
    assert(themes.size() == 1);
    assert(themes[0]["manifest"]["path"] == (root / "Themes" / "dark").string());
    assert(themes[0]["bundle"].contains("semantic"));

    write(root / "Fonts" / "Inter.ttf", "font");
    nlohmann::json fonts = loader::scanFonts(root.string());
    assert(fonts.size() == 1);
    assert(fonts[0]["name"] == "Inter");
    assert(fonts[0]["displayName"] == "Inter");
    assert(fonts[0]["source"] == "custom");
    assert(fonts[0]["file"] == "Inter.ttf");

    loader::PreloadPayload payload;
    payload.settings    = nlohmann::json::parse(R"({"unbound":{}})");
    payload.plugins     = plugins;
    payload.origin      = "libunbound.so";
    payload.version     = "1.0.0";
    nlohmann::json data = loader::preloadData(payload);
    assert(data["settings"] == nlohmann::json::parse(R"({"unbound":{}})"));
    assert(data["themes"] == nlohmann::json::array());
    assert(data["loader"]["origin"] == "libunbound.so" && data["loader"]["version"] == "1.0.0");
    assert(data["plugins"][0]["manifest"]["id"] == "a.good");

    payload.themes = nlohmann::json::parse(
        R"([{"manifest":{"id":"t"},"bundle":{"semantic":{}}},{"manifest":{"id":"s"},"bundle":"{}"}])");
    data = loader::preloadData(payload);
    assert(data["themes"][0]["bundle"] == R"({"semantic":{}})");
    assert(data["themes"][1]["bundle"] == "{}");

    loader::AddonState addons;
    assert(addons.plugins().empty() && !addons.theme("t.dark"));
    addons.scan(root.string());
    assert(addons.plugins().size() == 1 && addons.themes().size() == 1 &&
           addons.fonts().size() == 1);
    assert(addons.theme("t.dark") && (*addons.theme("t.dark"))["manifest"]["id"] == "t.dark");
    assert(!addons.theme("t.none"));

    loader::SettingsStore settings((root / "settings.json").string());
    settings.set("unbound", "recovery", false);
    loader::PreloadPayload made = loader::makePreloadPayload(
        settings, addons, nlohmann::json::array({"Ginto"}), "Unbound.dylib");
    assert(made.plugins[0]["manifest"]["id"] == "a.good");
    assert(made.availableFonts == nlohmann::json::array({"Ginto"}));
    assert(made.settings["unbound"].contains("recovery"));
    assert(made.origin == "Unbound.dylib" && made.version == loader::loaderVersion());

    std::filesystem::remove_all(root);
    return 0;
}
