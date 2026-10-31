#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <hermes/hermes.h>
#include <jsi/jsi.h>
#include <memory>
#include <nlohmann/json.hpp>
#include <string>

#include "LoaderSettings.h"
#include "NativePlatformBridge.h"

namespace jsi = facebook::jsi;

static const char *const kBridgeChecks = R"JS((function () {
	var failures = [];
	function check(condition, name) {
		if (!condition) failures.push(name);
	}
	function throws(body) {
		try {
			body();
			return false;
		} catch (error) {
			return error instanceof Error;
		}
	}

	var platform = globalThis.NativePlatform;
	check(platform && platform.platform === 'android', 'platform name');
	check(platform.device.platform === 'android', 'device platform');
	check(platform.device.getDeviceModel() === 'Pixel Test', 'device model');
	check(platform.device.getOSVersionString() === '15', 'os version');
	check(platform.device.isRooted() === true, 'rooted');
	check(platform.device.isVirtualDevice() === true, 'virtual device');
	check(platform.app.getAppSource() === 'tests', 'app source');
	check(platform.app.claimLaunchURL() === true, 'first launch URL claim');
	check(platform.app.claimLaunchURL() === false, 'second launch URL claim');

	var fonts = platform.fonts.list();
	check(Array.isArray(fonts) && fonts.length === 1 && fonts[0].name === 'Test Sans', 'fonts list');

	check(platform.settings.apply([{ store: 'astral', key: 'answer', value: { nested: [1, 'two', null] } }]) === true, 'settings apply');
	check(platform.settings.apply([{ store: 'astral', key: 'answer', remove: true }, { store: 'other', key: 'kept', value: true }]) === true, 'settings remove');
	check(throws(function () { platform.settings.apply('not changes'); }), 'settings apply rejects a non-array');
	check(platform.settings.apply([{ key: 'no store' }, 7, null]) === true, 'settings apply skips malformed changes');
	var cyclic = { name: 'loop' };
	cyclic.self = cyclic;
	check(throws(function () { platform.settings.apply([{ store: 'astral', key: 'cyclic', value: cyclic }]); }), 'settings apply refuses a value that refers to itself');
	var deep = {};
	var cursor = deep;
	for (var level = 0; level < 5000; level++) { cursor.next = {}; cursor = cursor.next; }
	check(throws(function () { platform.settings.apply([{ store: 'astral', key: 'deep', value: deep }]); }), 'settings apply refuses a value nested thousands deep');
	var nested = {};
	var nestedCursor = nested;
	for (var depth = 0; depth < 140; depth++) { nestedCursor.next = {}; nestedCursor = nestedCursor.next; }
	check(throws(function () { platform.settings.apply([{ store: 'astral', key: 'nested', value: nested }]); }), 'settings apply refuses a value past the native depth limit');

	check(platform.files.remove('Plugins/doomed') === true, 'files remove inside documents');
	check(platform.files.remove('Plugins/doomed') === false, 'files remove twice');
	check(platform.files.remove('../outside') === false, 'files remove refuses to escape');
	check(platform.files.remove('/etc') === false, 'files remove refuses absolute paths');
	check(platform.files.remove() === false, 'files remove without a path');

	check(typeof platform.crashGuard.register('astral.example', 'Example') === 'number', 'crash guard register');
	check(typeof platform.crashGuard.begin('astral.example', 'Example') === 'boolean', 'crash guard begin');
	check(typeof platform.crashGuard.end('astral.example') === 'boolean', 'crash guard end');
	var cell = platform.crashGuard.activity();
	check(cell === undefined || cell instanceof ArrayBuffer, 'crash guard activity cell');

	var missing = platform.addons.verify();
	check(missing.status === 'invalid' && typeof missing.problem === 'string', 'verify without arguments');
	check(platform.addons.verify('"a string"', 'bundle').status === 'invalid', 'verify a non-object manifest');
	check(platform.addons.verify('{"id":"astral.example","version":"1.0.0"}', 'bundle').status === 'unsigned', 'verify an unsigned manifest');
	var forged = platform.addons.verify('{"id":"astral.example","version":"1.0.0","signature":"AAAA"}', 'bundle');
	check(forged.status === 'invalid', 'verify a forged signature');

	return JSON.stringify(failures);
})())JS";

static void require(bool condition, const char *check)
{
    if (!condition)
    {
        std::fprintf(stderr, "native platform check failed: %s\n", check);
        std::exit(1);
    }
}

int main()
{
    std::filesystem::path documents =
        std::filesystem::temp_directory_path() / "astral-native-platform-hermes";
    std::filesystem::remove_all(documents);
    std::filesystem::create_directories(documents / "Plugins" / "doomed");
    std::filesystem::path outside = documents.parent_path() / "outside";
    std::filesystem::create_directories(outside);

    loader::SettingsStore settings((documents / "settings.json").string());
    settings.load();

    auto provider         = std::make_shared<loader::NativePlatformProvider>();
    provider->platform    = "android";
    provider->deviceModel = [] {
        return std::string("Pixel Test");
    };
    provider->osVersion = [] {
        return std::string("15");
    };
    provider->isRooted = [] {
        return true;
    };
    provider->isSystemApp = [] {
        return false;
    };
    provider->isVirtualDevice = [] {
        return true;
    };
    provider->appSource = [] {
        return std::string("tests");
    };
    provider->documents = documents.string();
    provider->settings  = &settings;
    provider->fonts     = [] {
        return nlohmann::json::array({{{"name", "Test Sans"}}});
    };

    auto runtime = facebook::hermes::makeHermesRuntime();
    loader::installNativePlatform(*runtime, provider);
    jsi::Value result = runtime->evaluateJavaScript(
        std::make_shared<jsi::StringBuffer>(kBridgeChecks), "native-platform-checks.js");
    nlohmann::json failures = nlohmann::json::parse(result.getString(*runtime).utf8(*runtime));
    for (const auto &failure : failures)
    {
        std::fprintf(stderr, "native platform check failed: %s\n",
                     failure.get<std::string>().c_str());
    }
    require(failures.empty(), "every JavaScript check passes");

    auto reloaded = facebook::hermes::makeHermesRuntime();
    loader::installNativePlatform(*reloaded, provider);
    jsi::Value reclaimed = reloaded->evaluateJavaScript(
        std::make_shared<jsi::StringBuffer>("globalThis.NativePlatform.app.claimLaunchURL()"),
        "reload-claim.js");
    require(reclaimed.isBool() && !reclaimed.getBool(),
            "a reloaded runtime sees the launch URL as claimed");
    require(!settings.get("astral", "answer").has_value(), "a removed setting is gone natively");
    require(settings.getBoolean("other", "kept", false), "an applied setting is stored natively");
    require(!std::filesystem::exists(documents / "Plugins" / "doomed"),
            "the removed folder is gone");
    require(std::filesystem::exists(outside), "nothing outside the documents folder was removed");

    std::filesystem::remove_all(documents);
    std::filesystem::remove_all(outside);
    std::printf("native platform bridge: all checks passed on Hermes\n");
    return 0;
}
