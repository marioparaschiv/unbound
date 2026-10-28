#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <hermes/hermes.h>
#include <jsi/jsi.h>
#include <memory>
#include <nlohmann/json.hpp>
#include <optional>
#include <sstream>
#include <string>

#include "HermesBytecodeHeader.h"
#include "LoaderAddons.h"
#include "LoaderBootstrap.h"
#include "LoaderBundleSignature.h"
#include "LoaderPreload.h"
#include "LoaderSettings.h"
#include "NativePlatformBridge.h"

namespace fs  = std::filesystem;
namespace jsi = facebook::jsi;

static void require(bool condition, const std::string &check)
{
    if (!condition)
    {
        std::fprintf(stderr, "preload check failed: %s\n", check.c_str());
        std::exit(1);
    }
}

static std::optional<std::string> bootstrapScript(const std::string &name)
{
    std::ifstream file(std::string(UNBOUND_BOOTSTRAP_DIR) + "/" + name + ".js");
    if (!file)
    {
        return std::nullopt;
    }
    std::stringstream contents;
    contents << file.rdbuf();
    return contents.str();
}

static void write(const fs::path &path, const std::string &contents)
{
    fs::create_directories(path.parent_path());
    std::ofstream(path, std::ios::binary) << contents;
}

static void plugin(const fs::path &documents, const std::string &folder,
                   const std::string &manifest, const std::string &bundle)
{
    write(documents / "Plugins" / folder / "manifest.json", manifest);
    write(documents / "Plugins" / folder / "index.js", bundle);
}

static std::string compiledPlugin(const fs::path &documents, uint32_t &version)
{
    fs::path source = documents / "compiled-source.js";
    fs::path output = documents / "compiled.hbc";
    write(source, "((React) => { return ({ marker: React.tag + '-bytecode' }) })");
    std::string command = std::string("\"") + UNBOUND_HERMESC + "\" --emit-binary -O -g0 --out \"" +
                          output.string() + "\" \"" + source.string() + "\"";
    require(std::system(command.c_str()) == 0, "hermesc compiles the plugin");
    version = loader::hermesBytecodeVersionOfFile(output.string());
    require(version > 0, "hermesc writes Hermes bytecode");
    std::ifstream     file(output, std::ios::binary);
    std::stringstream contents;
    contents << file.rdbuf();
    return contents.str();
}

static const char *const kPreloadChecks = R"JS((function () {
	var failures = [];
	function check(condition, name) {
		if (!condition) failures.push(name);
	}
	var plugins = globalThis.UNBOUND_PLUGINS;
	check(Array.isArray(plugins), 'UNBOUND_PLUGINS is an array');
	var ids = plugins.map(function (entry) { return entry.manifest.id; }).sort();
	check(JSON.stringify(ids) === JSON.stringify(['a.binary', 'a.compiled', 'a.large', 'a.plain', 'a.tampered', 'a.unicode']), 'exactly the loadable plugins arrive, got ' + JSON.stringify(ids));
	var byId = {};
	plugins.forEach(function (entry) { byId[entry.manifest.id] = entry; });
	check(byId['a.plain'].bundle === 'module.exports = 1;', 'a plain bundle arrives unchanged');
	check(byId['a.unicode'].manifest.name === 'Ünïcødé 😀 名前', 'a unicode name arrives intact');
	var binary = byId['a.binary'].bundle;
	check(binary === 'a\uFFFD\uFFFD\uFFFDz', 'invalid UTF-8 in a bundle is replaced, not truncated, got ' + JSON.stringify(binary));
	check(byId['a.large'].bundle.length === 3 * 1024 * 1024, 'a 3 MiB bundle arrives whole');
	check(byId['a.plain'].manifest.trust === 'unsigned' && typeof byId['a.plain'].manifest.entry === 'string', 'the loader adds trust and entry');
	check(Array.isArray(globalThis.UNBOUND_THEMES) && globalThis.UNBOUND_THEMES.length === 1, 'the valid theme arrives');
	check(typeof globalThis.UNBOUND_SETTINGS === 'object' && globalThis.UNBOUND_SETTINGS.unbound.answer === 42, 'settings arrive');
	check(globalThis.UNBOUND_SETTINGS['名前'] && globalThis.UNBOUND_SETTINGS['名前']['ü'] === 1, 'unicode settings keys arrive intact, got ' + JSON.stringify(Object.keys(globalThis.UNBOUND_SETTINGS)));
	check(Array.isArray(globalThis.UNBOUND_FONTS), 'UNBOUND_FONTS is an array');
	check(Array.isArray(globalThis.UNBOUND_AVAILABLE_FONTS) && globalThis.UNBOUND_AVAILABLE_FONTS[0] === 'System', 'available fonts arrive');
	check(globalThis.UNBOUND_LOADER.origin === 'https://example.invalid' && typeof globalThis.UNBOUND_LOADER.version === 'string', 'loader info arrives');
	var version = globalThis.UNBOUND_LOADER.bytecodeVersion;
	check(typeof version === 'number' && version > 0, 'the runtime bytecode version arrives');
	var addons = globalThis.NativePlatform.addons;
	var factory = addons.evaluateBytecode('compiled', version);
	check(typeof factory === 'function', 'a plugin compiled for this runtime evaluates to its factory');
	var instance = factory && factory({ tag: 'scoped' });
	check(instance && instance.marker === 'scoped-bytecode', 'the factory receives the scoped React');
	check(addons.evaluateBytecode('compiled', version + 1) === undefined, 'another bytecode version is not loaded');
	check(addons.evaluateBytecode('tampered', version) === undefined, 'bytecode that does not match its digest is not loaded');
	check(addons.evaluateBytecode('../Plugins/compiled', version) === undefined, 'a folder outside Plugins is refused');
	check(addons.evaluateBytecode('plain', version) === undefined, 'a plugin without bytecode is not loaded');
	check(addons.evaluateBytecode('compiled', -1) === undefined && addons.evaluateBytecode('compiled', 1.5) === undefined, 'a malformed version is refused');
	return JSON.stringify(failures);
})())JS";

int main()
{
    loader::bootstrap::setScriptSource(bootstrapScript);
    fs::path documents = fs::temp_directory_path() / "unbound-preload-hermes";
    fs::remove_all(documents);

    plugin(documents, "plain", R"({"id":"a.plain","name":"Plain","main":"index.js"})",
           "module.exports = 1;");
    plugin(documents, "unicode", R"({"id":"a.unicode","name":"Ünïcødé 😀 名前","main":"index.js"})",
           "module.exports = 2;");
    plugin(documents, "binary", R"({"id":"a.binary","name":"Binary","main":"index.js"})",
           std::string("a\xff\xfe\x80z", 5));
    plugin(documents, "large", R"({"id":"a.large","name":"Large","main":"index.js"})",
           std::string(3 * 1024 * 1024, 'x'));
    std::string deep = "{\"id\":\"a.deep\",\"name\":\"Deep\",\"main\":\"index.js\",\"extra\":";
    for (int level = 0; level < 50000; level++)
    {
        deep += "{\"a\":";
    }
    deep += "1" + std::string(50000, '}') + "}";
    plugin(documents, "deep", deep, "module.exports = 3;");
    plugin(documents, "broken", "{\"id\":", "module.exports = 4;");
    write(documents / "Themes" / "good" / "manifest.json", R"({"id":"theme.good","name":"Good"})");
    write(documents / "Themes" / "good" / "bundle.json", R"({"semantic":{},"raw":{}})");
    write(documents / "settings.json", R"({"unbound":{"answer":42},"名前":{"ü":1}})");
    uint32_t    version  = 0;
    std::string bytecode = compiledPlugin(documents, version);
    plugin(documents, "compiled",
           R"({"id":"a.compiled","name":"Compiled","main":"index.js","bytecode":{")" +
               std::to_string(version) + R"(":")" + loader::sha512Hex(bytecode) + R"("}})",
           "module.exports = 5;");
    write(documents / "Plugins" / "compiled" / ("index." + std::to_string(version) + ".hbc"),
          bytecode);
    plugin(documents, "tampered",
           R"({"id":"a.tampered","main":"index.js","bytecode":{")" + std::to_string(version) +
               R"(":")" + loader::sha512Hex("something else") + R"("}})",
           "module.exports = 6;");
    write(documents / "Plugins" / "tampered" / ("index." + std::to_string(version) + ".hbc"),
          bytecode);

    loader::SettingsStore settings((documents / "settings.json").string());
    settings.load();
    loader::AddonState addons;
    addons.scan(documents.string());
    loader::PreloadPayload payload = loader::makePreloadPayload(
        settings, addons, nlohmann::json::array({"System"}), "https://example.invalid", version);

    auto runtime        = facebook::hermes::makeHermesRuntime();
    auto provider       = std::make_shared<loader::NativePlatformProvider>();
    provider->platform  = "host";
    provider->documents = documents.string();
    loader::installNativePlatform(*runtime, provider);
    auto preload = loader::bootstrap::function(*runtime, loader::bootstrap::kPreload);
    require(preload.has_value(), "the preload bootstrap evaluates to a function");
    preload->call(*runtime, loader::toJSIValue(*runtime, loader::preloadData(payload)));

    jsi::Value result = runtime->evaluateJavaScript(
        std::make_shared<jsi::StringBuffer>(kPreloadChecks), "preload-checks.js");
    nlohmann::json failures = nlohmann::json::parse(result.getString(*runtime).utf8(*runtime));
    for (const auto &failure : failures)
    {
        std::fprintf(stderr, "preload check failed: %s\n", failure.get<std::string>().c_str());
    }
    require(failures.empty(), "every JavaScript check passes");
    fs::remove_all(documents);
    std::printf("preload: the real scan, payload and preload.js all agree on Hermes\n");
    return 0;
}
