#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <hermes/hermes.h>
#include <jsi/jsi.h>
#include <memory>
#include <nlohmann/json.hpp>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>

#include "LoaderBootstrap.h"
#include "NativePluginRuntime.h"
#if ASTRAL_TEST_FFI
#include "NativeFFI.h"
#endif

namespace jsi = facebook::jsi;

static void require(bool condition, const std::string &check)
{
    if (!condition)
    {
        std::fprintf(stderr, "native runtime check failed: %s\n", check.c_str());
        std::exit(1);
    }
}

static std::optional<std::string> bootstrapScript(const std::string &name)
{
    std::ifstream file(std::string(ASTRAL_BOOTSTRAP_DIR) + "/" + name + ".js");
    if (!file)
    {
        return std::nullopt;
    }
    std::stringstream contents;
    contents << file.rdbuf();
    return contents.str();
}

static void install(jsi::Runtime &runtime, const char *name, jsi::HostFunctionType handler)
{
    runtime.global().setProperty(
        runtime, name, loader::native::makeFunction(runtime, name, 1, std::move(handler)));
}

static void installProbes(jsi::Runtime &runtime)
{
    install(runtime, "throwsPlain",
            [](jsi::Runtime &, const jsi::Value &, const jsi::Value *, size_t) -> jsi::Value {
                throw std::runtime_error("plain failure");
            });
    install(runtime, "throwsCoded",
            [](jsi::Runtime &, const jsi::Value &, const jsi::Value *, size_t) -> jsi::Value {
                throw loader::native::NativeCodedError("PROBE_CODE", "coded failure");
            });
    install(runtime, "throwsArgument",
            [](jsi::Runtime &, const jsi::Value &, const jsi::Value *, size_t) -> jsi::Value {
                throw std::invalid_argument("bad argument");
            });
    install(runtime, "throwsJS",
            [](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *, size_t) -> jsi::Value {
                throw jsi::JSError(rt, "js failure");
            });
    install(runtime, "echo",
            [](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
               size_t count) -> jsi::Value {
                return count ? jsi::Value(rt, args[0]) : jsi::Value::undefined();
            });
#if ASTRAL_TEST_FFI
    jsi::Object ffi(runtime);
    ffi.setProperty(runtime, "symbol",
                    loader::native::makeFunction(runtime, "symbol", 2,
                                                 [](jsi::Runtime     &rt, const jsi::Value &,
                                                    const jsi::Value *args, size_t count) {
                                                     return loader::ffi::lookupSymbol(rt, args,
                                                                                      count);
                                                 }));
    ffi.setProperty(runtime, "call",
                    loader::native::makeFunction(runtime, "call", 3,
                                                 [](jsi::Runtime     &rt, const jsi::Value &,
                                                    const jsi::Value *args, size_t count) {
                                                     return loader::ffi::callFunction(rt, args,
                                                                                      count);
                                                 }));
    runtime.global().setProperty(runtime, "ffi", std::move(ffi));
#endif
}

static const char *const kRuntimeChecks = R"JS((function () {
	var failures = [];
	function check(condition, name) {
		if (!condition) failures.push(name);
	}
	function caught(body) {
		try {
			body();
		} catch (error) {
			return error;
		}
		return null;
	}

	var plain = caught(function () { throwsPlain(); });
	check(plain instanceof Error && plain.message.indexOf('plain failure') !== -1, 'a plain C++ exception reaches JS as an Error');
	check(plain && typeof plain.code === 'string' && plain.code.length > 0, 'a plain failure carries a code');

	var coded = caught(function () { throwsCoded(); });
	check(coded instanceof Error && coded.code === 'PROBE_CODE' && coded.message.indexOf('coded failure') !== -1, 'a coded failure keeps its code and message');

	var argument = caught(function () { throwsArgument(); });
	check(argument instanceof Error && argument.message.indexOf('bad argument') !== -1, 'an argument error reaches JS');

	var js = caught(function () { throwsJS(); });
	check(js instanceof Error && js.message.indexOf('js failure') !== -1 && typeof js.code === 'string', 'a JS error from native gets a default code');

	check(echo(42) === 42 && echo('text') === 'text' && echo() === undefined, 'values pass straight through');
	var object = { nested: [1, 2] };
	check(echo(object) === object, 'objects keep their identity');

	for (var index = 0; index < 200; index++) {
		caught(function () { throwsPlain(); });
	}
	check(echo('still alive') === 'still alive', 'repeated failures leave the runtime usable');

	if (typeof ffi !== 'undefined') {
		var strlen = ffi.symbol('strlen');
		check(strlen !== null && typeof strlen === 'object', 'ffi.symbol finds strlen');
		check(Number(ffi.call(strlen, { returnType: 'u64', args: ['cstring'] }, 'hermes')) === 6, 'ffi.call runs strlen through libffi');
		check(ffi.symbol('definitely_not_a_symbol_astral') === null, 'a missing symbol is null');
		check(caught(function () { ffi.call(strlen, { returnType: 'u64', args: ['cstring'] }); }) instanceof Error, 'a wrong argument count is refused');
		check(caught(function () { ffi.call(strlen, { args: ['cstring'] }, 'x'); }) instanceof Error, 'a signature without a return type is refused');
		check(caught(function () { ffi.call(strlen, { returnType: 'u64', args: ['not-a-type'] }, 'x'); }) instanceof Error, 'an unknown type is refused');
		check(caught(function () { ffi.call({}, { returnType: 'u64', args: [] }); }) instanceof Error, 'a non-pointer is refused');
		check(caught(function () { ffi.symbol(); }) instanceof Error, 'ffi.symbol without a name is refused');
	}

	return JSON.stringify(failures);
})())JS";

static void runChecks(loader::native::NativeErrorDelivery delivery, const char *mode)
{
    loader::native::setNativeErrorDelivery(delivery);
    auto runtime = facebook::hermes::makeHermesRuntime();

    uint64_t before = loader::native::runtimeGeneration();
    loader::native::registerRuntime(*runtime);
    require(loader::native::runtimeGeneration() > before,
            std::string(mode) + ": registering a runtime advances its generation");
    require(loader::native::isRuntimeThread(),
            std::string(mode) + ": the registering thread is the runtime thread");

    installProbes(*runtime);
    jsi::Value result = runtime->evaluateJavaScript(
        std::make_shared<jsi::StringBuffer>(kRuntimeChecks), "native-runtime-checks.js");
    nlohmann::json failures = nlohmann::json::parse(result.getString(*runtime).utf8(*runtime));
    for (const auto &failure : failures)
    {
        std::fprintf(stderr, "%s: %s\n", mode, failure.get<std::string>().c_str());
    }
    require(failures.empty(), std::string(mode) + ": every JavaScript check passes");
}

static void freshRuntimesAdvanceTheGeneration()
{
    const void *previousAddress = nullptr;
    bool        reusedAnAddress = false;
    for (int round = 0; round < 8; round++)
    {
        auto     runtime = facebook::hermes::makeHermesRuntime();
        uint64_t before  = loader::native::runtimeGeneration();
        uint64_t current = loader::native::registerRuntime(*runtime);
        require(current > before, "a fresh runtime advances the generation");
        require(loader::native::registerRuntime(*runtime) == current,
                "registering the same runtime again keeps its generation");
        reusedAnAddress |= runtime.get() == previousAddress;
        previousAddress = runtime.get();
    }
    std::printf("native runtime: fresh runtimes advance the generation%s\n",
                reusedAnAddress ? ", including one at a reused address" : "");
}

int main()
{
    loader::bootstrap::setScriptSource(bootstrapScript);
    runChecks(loader::native::NativeErrorDelivery::Throw, "throw delivery");
    runChecks(loader::native::NativeErrorDelivery::Envelope, "envelope delivery");
    freshRuntimesAdvanceTheGeneration();
    std::printf("native runtime: all checks passed on Hermes in both error deliveries%s\n",
                ASTRAL_TEST_FFI ? ", FFI included" : "");
    return 0;
}
