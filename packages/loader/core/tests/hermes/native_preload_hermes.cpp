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

#include "LoaderAddons.h"
#include "LoaderBootstrap.h"
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

static const char *const kPreloadChecks = R"JS((function () {
	var failures = [];
	function check(condition, name) {
		if (!condition) failures.push(name);
	}
	var plugins = globalThis.UNBOUND_PLUGINS;
	check(Array.isArray(plugins), 'UNBOUND_PLUGINS is an array');
	var ids = plugins.map(function (entry) { return entry.manifest.id; }).sort();
	check(JSON.stringify(ids) === JSON.stringify(['a.binary', 'a.large', 'a.plain', 'a.unicode']), 'exactly the loadable plugins arrive, got ' + JSON.stringify(ids));
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

    loader::SettingsStore settings((documents / "settings.json").string());
    settings.load();
    loader::AddonState addons;
    addons.scan(documents.string());
    loader::PreloadPayload payload = loader::makePreloadPayload(
        settings, addons, nlohmann::json::array({"System"}), "https://example.invalid");

    auto runtime = facebook::hermes::makeHermesRuntime();
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
