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
#include "LoaderSettings.h"
#include "NativePlatformBridge.h"
#include "UnboundNativeBridge.h"

namespace fs  = std::filesystem;
namespace jsi = facebook::jsi;

static void require(bool condition, const std::string &check)
{
    if (!condition)
    {
        std::fprintf(stderr, "UnboundNative check failed: %s\n", check.c_str());
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

static const std::string kThemeBundle = "{ \"semantic\": {},\n  \"raw\":{ }, \"ü\": \"名前\" }\n";

static const char *const kUnboundNativeChecks = R"JS((function () {
	var failures = [];
	function check(condition, name) {
		if (!condition) failures.push(name);
	}
	var plugins = UnboundNative.getPlugins();
	check(Array.isArray(plugins), 'getPlugins returns an array');
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
	var themes = UnboundNative.getThemes();
	check(Array.isArray(themes) && themes.length === 1, 'the valid theme arrives');
	check(themes[0].bundle === expectedThemeBundle, 'a theme bundle arrives as its file text, got ' + JSON.stringify(themes[0].bundle));
	check(NativePlatform.settings.get('unbound', 'answer') === 42, 'a setting is read lazily');
	check(NativePlatform.settings.get('名前', 'ü') === 1, 'unicode settings keys are read intact');
	check(Array.isArray(UnboundNative.getFonts()), 'getFonts returns an array');
	var available = UnboundNative.getAvailableFonts();
	check(Array.isArray(available) && available[0] === 'System', 'available fonts arrive');
	check(UnboundNative.getAvailableFonts()[0] === 'System', 'available fonts arrive again from the cache');
	var loader = UnboundNative.getLoader();
	check(loader.origin === 'https://example.invalid' && typeof loader.version === 'string', 'loader info arrives');
	var version = loader.bytecodeVersion;
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
    fs::path documents = fs::temp_directory_path() / "unbound-native-hermes";
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
    write(documents / "Themes" / "good" / "bundle.json", kThemeBundle);
    write(documents / "Themes" / "list" / "manifest.json", R"({"id":"theme.list"})");
    write(documents / "Themes" / "list" / "bundle.json", "[]");
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
    int  fontReads  = 0;
    auto launchData = loader::makeUnboundNativeProvider(
        addons,
        [&fontReads] {
            fontReads++;
            return nlohmann::json::array({"System"});
        },
        "https://example.invalid", version);

    auto runtime        = facebook::hermes::makeHermesRuntime();
    auto provider       = std::make_shared<loader::NativePlatformProvider>();
    provider->platform  = "host";
    provider->documents = documents.string();
    provider->settings  = &settings;
    loader::installNativePlatform(*runtime, provider);
    loader::installUnboundNative(*runtime, launchData);
    runtime->global().setProperty(*runtime, "expectedThemeBundle",
                                  jsi::String::createFromUtf8(*runtime, kThemeBundle));
    require(fontReads == 0, "installing UnboundNative reads no fonts");

    jsi::Value result = runtime->evaluateJavaScript(
        std::make_shared<jsi::StringBuffer>(kUnboundNativeChecks), "unbound-native-checks.js");
    nlohmann::json failures = nlohmann::json::parse(result.getString(*runtime).utf8(*runtime));
    for (const auto &failure : failures)
    {
        std::fprintf(stderr, "UnboundNative check failed: %s\n",
                     failure.get<std::string>().c_str());
    }
    require(failures.empty(), "every JavaScript check passes");
    require(fontReads == 1, "getAvailableFonts reads its provider once across two calls");
    fs::remove_all(documents);
    std::printf("UnboundNative: the real scan and the bridge agree on Hermes\n");
    return 0;
}
