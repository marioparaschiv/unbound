#include <cassert>
#include <filesystem>
#include <string>
#include <unistd.h>

#include "LoaderAddons.h"
#include "LoaderBundleSignature.h"
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

static void pluginEntriesStayInsideTheirFolder()
{
    const auto root    = makeTemporaryDirectory();
    const auto plugins = root / "Plugins";
    write(root / "secret.txt", "outside");
    write(plugins / "relative" / "manifest.json",
          R"({"id":"a.relative","main":"./sub/../index.js"})");
    write(plugins / "relative" / "index.js", "relative");
    write(plugins / "absolute" / "manifest.json", R"({"id":"a.absolute","main":"/etc/hosts"})");
    write(plugins / "parent" / "manifest.json", R"({"id":"a.parent","main":"../../secret.txt"})");
    write(plugins / "linked" / "manifest.json", R"({"id":"a.linked","main":"index.js"})");
    std::filesystem::create_symlink(root / "secret.txt", plugins / "linked" / "index.js");

    nlohmann::json found = loader::scanPlugins(root.string());
    assert(found.size() == 1);
    assert(found[0]["manifest"]["id"] == "a.relative");
    assert(found[0]["bundle"] == "relative");
    std::filesystem::remove_all(root);
}

static std::string fakeBytecode(uint32_t version, const std::string &body)
{
    std::string bytes = {'\xC6', '\x1F', '\xBC', '\x03', '\xC1', '\x03', '\x19', '\x1F'};
    for (int shift = 0; shift < 32; shift += 8)
    {
        bytes.push_back(static_cast<char>((version >> shift) & 0xFF));
    }
    return bytes + body;
}

static void pluginBytecodeMatchesItsManifest()
{
    const auto        root     = makeTemporaryDirectory();
    const auto        folder   = root / "Plugins" / "compiled";
    const std::string bytecode = fakeBytecode(98, "body");
    const std::string manifest = R"({"id":"a.compiled","main":"dist/index.js","bytecode":{"98":")" +
                                 loader::sha512Hex(bytecode) + R"(","96":")" +
                                 loader::sha512Hex("other") + R"("}})";
    write(folder / "manifest.json", manifest);
    write(folder / "dist" / "index.js", "module.exports = 1;");
    write(folder / "dist" / "index.98.hbc", bytecode);
    write(folder / "dist" / "index.96.hbc", fakeBytecode(96, "stale"));

    assert(loader::readPluginBytecode(root.string(), "compiled", 98) == bytecode);
    assert(!loader::readPluginBytecode(root.string(), "compiled", 96));
    assert(!loader::readPluginBytecode(root.string(), "compiled", 94));
    assert(!loader::readPluginBytecode(root.string(), "compiled", 0));
    assert(!loader::readPluginBytecode(root.string(), "../Plugins/compiled", 98));
    assert(!loader::readPluginBytecode(root.string(), "..", 98));
    assert(!loader::readPluginBytecode(root.string(), "", 98));
    assert(!loader::readPluginBytecode(root.string(), "missing", 98));

    write(folder / "dist" / "index.98.hbc", fakeBytecode(96, "body"));
    assert(!loader::readPluginBytecode(root.string(), "compiled", 98));
    write(folder / "dist" / "index.98.hbc", bytecode + " ");
    assert(!loader::readPluginBytecode(root.string(), "compiled", 98));

    write(folder / "manifest.json", R"({"id":"a.compiled","main":"dist/index.js"})");
    write(folder / "dist" / "index.98.hbc", bytecode);
    assert(!loader::readPluginBytecode(root.string(), "compiled", 98));

    std::filesystem::remove_all(root);
}

int main()
{
    pluginEntriesStayInsideTheirFolder();
    pluginBytecodeMatchesItsManifest();

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
        settings, addons, nlohmann::json::array({"Ginto"}), "Unbound.dylib", 98);
    assert(made.bytecodeVersion == 98);
    assert(loader::preloadData(made)["loader"]["bytecodeVersion"] == 98);
    assert(made.plugins[0]["manifest"]["id"] == "a.good");
    assert(made.availableFonts == nlohmann::json::array({"Ginto"}));
    assert(made.settings["unbound"].contains("recovery"));
    assert(made.origin == "Unbound.dylib" && made.version == loader::loaderVersion());

    std::filesystem::remove_all(root);
    return 0;
}
