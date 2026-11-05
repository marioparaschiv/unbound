#include <cassert>
#include <filesystem>
#include <fstream>
#include <map>
#include <optional>
#include <stdexcept>
#include <string>
#include <unistd.h>

#include "LoaderAddons.h"
#include "LoaderBundleSignature.h"
#include "LoaderCrypto.h"
#include "LoaderFiles.h"
#include "LoaderRequiredLoader.h"
#include "LoaderVersion.h"
#include "UnboundNativeBridge.h"

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

static void compiledPluginsLeaveTheirSourceOnDisk()
{
    const auto        root     = makeTemporaryDirectory();
    const auto        folder   = root / "Plugins" / "compiled";
    const std::string source   = "module.exports = 1;";
    const std::string bytecode = fakeBytecode(98, "body");
    write(folder / "manifest.json", R"({"id":"a.compiled","main":"index.js","bytecode":{"98":")" +
                                        loader::sha512Hex(bytecode) + R"("}})");
    write(folder / "index.js", source);
    write(folder / "index.98.hbc", bytecode);

    nlohmann::json compiled = loader::scanPlugins(root.string(), 98);
    assert(compiled.size() == 1);
    assert(!compiled[0].contains("bundle"));
    assert(compiled[0]["sha256"] == loader::crypto::hex(loader::crypto::sha256(source)));
    assert(loader::readPluginSource(root.string(), "compiled") == source);
    assert(!loader::readPluginSource(root.string(), ".."));

    nlohmann::json otherRuntime = loader::scanPlugins(root.string(), 96);
    assert(otherRuntime[0]["bundle"] == source);
    assert(!otherRuntime[0].contains("sha256"));

    std::filesystem::remove(folder / "index.98.hbc");
    assert(loader::scanPlugins(root.string(), 98)[0]["bundle"] == source);

    std::filesystem::remove_all(root);
}

static void firstScanAdoptsThePrescan()
{
    const auto root = makeTemporaryDirectory();
    write(root / "Plugins" / "first" / "manifest.json", R"({"id":"a.first","main":"index.js"})");
    write(root / "Plugins" / "first" / "index.js", "first");

    loader::AddonState state;
    state.prescan(root.string(), 98);
    state.scan(root.string(), 98);
    assert(state.plugins().size() == 1);

    write(root / "Plugins" / "second" / "manifest.json", R"({"id":"a.second","main":"index.js"})");
    write(root / "Plugins" / "second" / "index.js", "second");
    state.prescan(root.string(), 98);
    state.scan(root.string(), 98);
    assert(state.plugins().size() == 2);

    loader::AddonState other;
    other.prescan(root.string(), 96);
    other.scan(root.string(), 98);
    assert(other.plugins().size() == 2);
    std::filesystem::remove_all(root);
}

int main()
{
    pluginEntriesStayInsideTheirFolder();
    pluginBytecodeMatchesItsManifest();
    compiledPluginsLeaveTheirSourceOnDisk();
    firstScanAdoptsThePrescan();

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
    write(root / "Themes" / "array-bundle" / "manifest.json", R"({"id":"t.array"})");
    write(root / "Themes" / "array-bundle" / "bundle.json", "[]");

    nlohmann::json themes = loader::scanThemes(root.string());
    assert(themes.size() == 1);
    assert(themes[0]["manifest"]["path"] == (root / "Themes" / "dark").string());
    assert(themes[0]["bundle"] == R"({"semantic":{}})");

    loader::AddonState addons;
    assert(addons.plugins().empty() && !addons.theme("t.dark"));
    addons.scan(root.string());
    assert(addons.plugins().size() == 1 && addons.themes().size() == 1);
    assert(addons.theme("t.dark") && (*addons.theme("t.dark"))["manifest"]["id"] == "t.dark");
    assert((*addons.theme("t.dark"))["bundle"] == nlohmann::json::parse(R"({"semantic":{}})"));
    assert(!addons.theme("t.none"));

    loader::UnboundNativeProvider provider = loader::makeUnboundNativeProvider(
        addons, nullptr, "Unbound.dylib", 98, root.string(),
        [](const std::string &url, const std::string &destination,
           const std::map<std::string, std::string> &,
           const loader::DownloadPolicy &) -> std::optional<loader::DownloadResult> {
            if (url == "https://offline.invalid")
            {
                return std::nullopt;
            }
            if (url == "https://missing.invalid")
            {
                return loader::DownloadResult{404, ""};
            }
            std::ofstream(destination, std::ios::binary) << url;
            return loader::DownloadResult{200, ""};
        });
    auto refuses = [&](const std::string &url, const std::string &path) {
        try
        {
            provider.downloadFile(url, path);
        }
        catch (const std::runtime_error &)
        {
            return true;
        }
        return false;
    };
    provider.downloadFile("https://fonts.invalid/a.ttf", "Fonts/Icons/a.ttf");
    assert(loader::readTextFile((root / "Fonts" / "Icons" / "a.ttf").string()) ==
           "https://fonts.invalid/a.ttf");
    assert(refuses("https://fonts.invalid/b.ttf", "../b.ttf"));
    assert(refuses("https://fonts.invalid/b.ttf", "Fonts/../../b.ttf"));
    assert(refuses("https://fonts.invalid/b.ttf", (root / "b.ttf").string()));
    assert(refuses("https://fonts.invalid/b.ttf", std::string("Fonts/b.ttf\0x", 13)));
    assert(refuses("https://fonts.invalid/b.ttf", ""));
    assert(refuses("https://offline.invalid", "Fonts/c.ttf"));
    assert(refuses("https://missing.invalid", "Fonts/c.ttf"));
    assert(!loader::fileExists((root.parent_path() / "b.ttf").string()));
    assert(provider.getLoader() == nlohmann::json({{"origin", "Unbound.dylib"},
                                                   {"version", loader::loaderVersion()},
                                                   {"bytecodeVersion", 98}}));
    loader::recordRequiredLoader(root.string(), "9.0.0");
    assert(provider.getLoader()["requiredVersion"] == "9.0.0");
    loader::recordRequiredLoader(root.string(), "");
    assert(!provider.getLoader().contains("requiredVersion"));
    assert(provider.getPlugins()[0]["manifest"]["id"] == "a.good");
    assert(provider.getThemes()[0]["bundle"] == R"({"semantic":{}})");
    assert(!provider.fonts);

    std::filesystem::remove_all(root);
    return 0;
}
