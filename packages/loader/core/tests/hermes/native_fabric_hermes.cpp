#include <cstdio>
#include <cstdlib>
#include <hermes/hermes.h>
#include <jsi/jsi.h>
#include <memory>
#include <string>
#include <vector>

#include "NativeFabric.h"
#include "NativePluginRuntime.h"

namespace jsi = facebook::jsi;

static void require(bool condition, const std::string &check)
{
    if (!condition)
    {
        std::fprintf(stderr, "native fabric check failed: %s\n", check.c_str());
        std::exit(1);
    }
}

class InlineExecutor final : public loader::native::NativePluginExecutor
{
public:
    bool isMainThread() override
    {
        return true;
    }

    void runOnMain(std::function<void()> work) override
    {
        work();
    }

    void runOnRuntime(std::function<void(jsi::Runtime &)>) override {}

    void runAfter(double, std::function<void()> work) override
    {
        work();
    }
};

class NamedView final : public loader::native::FabricView
{
public:
    explicit NamedView(std::string name) : name(std::move(name)) {}

    std::string name;
};

class RecordingAdapter final : public loader::native::FabricAdapter
{
public:
    std::shared_ptr<loader::native::FabricView> view(jsi::Runtime     &runtime,
                                                     const jsi::Value &handle) override
    {
        if (!handle.isString())
        {
            throw std::invalid_argument("A view handle must be a string here");
        }
        return std::make_shared<NamedView>(handle.getString(runtime).utf8(runtime));
    }

    std::string mount(const loader::native::FabricView &container, const std::string &moduleName,
                      const nlohmann::json &properties) override
    {
        std::string id = "surface-" + std::to_string(++mounted);
        calls.push_back("mount " + static_cast<const NamedView &>(container).name + " " +
                        moduleName + " " + properties.dump());
        return id;
    }

    void update(const std::string &surface, const nlohmann::json &properties) override
    {
        calls.push_back("update " + surface + " " + properties.dump());
    }

    void setSize(const std::string &surface, const loader::native::NativeSize &minimum,
                 const loader::native::NativeSize &maximum) override
    {
        calls.push_back("setSize " + surface + " " + loader::native::toJSON(minimum).dump() + " " +
                        loader::native::toJSON(maximum).dump());
    }

    void setFrame(const std::string &surface, const loader::native::NativeFrame &frame) override
    {
        calls.push_back("setFrame " + surface + " " + loader::native::toJSON(frame).dump());
    }

    loader::native::NativeFrame measure(const loader::native::FabricView &view) override
    {
        calls.push_back("measure " + static_cast<const NamedView &>(view).name);
        return {1, 2, 3, 4};
    }

    loader::native::NativeFrame measureSurface(const std::string &surface) override
    {
        calls.push_back("measureSurface " + surface);
        return {5, 6, 7, 8};
    }

    void unmount(const std::string &surface) override
    {
        calls.push_back("unmount " + surface);
    }

    int                      mounted = 0;
    std::vector<std::string> calls;
};

static bool sameCall(const std::string &actual, const std::string &expected)
{
    size_t actualJSON   = actual.find_first_of("{");
    size_t expectedJSON = expected.find_first_of("{");
    if (actualJSON == std::string::npos || expectedJSON == std::string::npos)
    {
        return actual == expected;
    }
    if (actual.substr(0, actualJSON) != expected.substr(0, expectedJSON))
    {
        return false;
    }
    std::string actualRest    = actual.substr(actualJSON);
    std::string expectedRest  = expected.substr(expectedJSON);
    size_t      actualSplit   = actualRest.find("} {");
    size_t      expectedSplit = expectedRest.find("} {");
    if (actualSplit != std::string::npos && expectedSplit != std::string::npos)
    {
        return nlohmann::json::parse(actualRest.substr(0, actualSplit + 1)) ==
                   nlohmann::json::parse(expectedRest.substr(0, expectedSplit + 1)) &&
               nlohmann::json::parse(actualRest.substr(actualSplit + 2)) ==
                   nlohmann::json::parse(expectedRest.substr(expectedSplit + 2));
    }
    return nlohmann::json::parse(actualRest) == nlohmann::json::parse(expectedRest);
}

static const char *const kFabricChecks = R"JS((function () {
	var failures = [];
	function check(condition, message) {
		if (!condition) failures.push(message);
	}
	function throws(run, message) {
		try {
			run();
			failures.push(message);
		} catch (error) {}
	}
	var surface = fabric.mount('container', 'Card', { surfaceId: 'a', revision: 1 });
	check(typeof surface === 'object' && surface.id === undefined, 'mount returns an opaque surface');
	fabric.update(surface, { revision: 2 });
	fabric.setSize(surface, { width: 10, height: 20 }, { width: 30, height: 40 });
	fabric.setFrame(surface, { x: 1, y: 2, width: 3, height: 4 });
	var surfaceFrame = fabric.measure(surface);
	check(surfaceFrame.x === 5 && surfaceFrame.height === 8, 'measure reads a surface frame');
	var viewFrame = fabric.measure('row');
	check(viewFrame.width === 3, 'measure reads a view frame');
	fabric.unmount(surface);
	fabric.unmount(surface);
	fabric.update(surface, { revision: 3 });
	throws(function () { fabric.mount('container'); }, 'mount requires a module name');
	throws(function () { fabric.mount('container', 'Card', [1]); }, 'mount rejects array properties');
	throws(function () { fabric.update({}, {}); }, 'update rejects a non-surface');
	throws(function () { fabric.setFrame(surface, { x: 'a' }); }, 'setFrame rejects a bad frame');
	check(typeof fabric.mountAsync === 'function', 'async calls are installed');
	globalThis.kept = fabric.mount('container', 'Card');
	return JSON.stringify(failures);
})())JS";

int main()
{
    loader::native::setExecutor(std::make_shared<InlineExecutor>());
    auto runtime = facebook::hermes::makeHermesRuntime();
    loader::native::registerRuntime(*runtime);

    auto adapter = std::make_shared<RecordingAdapter>();
    runtime->global().setProperty(
        *runtime, "fabric",
        loader::native::makeFabricNamespace(*runtime, adapter,
                                            loader::native::FabricCalls::SyncAndAsync));

    jsi::Value result = runtime->evaluateJavaScript(
        std::make_shared<jsi::StringBuffer>(kFabricChecks), "native-fabric-checks.js");
    nlohmann::json failures = nlohmann::json::parse(result.getString(*runtime).utf8(*runtime));
    for (const auto &failure : failures)
    {
        std::fprintf(stderr, "%s\n", failure.get<std::string>().c_str());
    }
    require(failures.empty(), "every JavaScript check passes");

    std::vector<std::string> expected = {
        "mount container Card {\"revision\":1,\"surfaceId\":\"a\"}",
        "update surface-1 {\"revision\":2}",
        "setSize surface-1 {\"height\":20,\"width\":10} {\"height\":40,\"width\":30}",
        "setFrame surface-1 {\"height\":4,\"width\":3,\"x\":1,\"y\":2}",
        "measureSurface surface-1",
        "measure row",
        "unmount surface-1",
        "mount container Card {}",
    };
    for (size_t index = 0; index < expected.size(); index++)
    {
        require(index < adapter->calls.size() && sameCall(adapter->calls[index], expected[index]),
                "call " + std::to_string(index) + " is " + expected[index] + ", got " +
                    (index < adapter->calls.size() ? adapter->calls[index] : "nothing"));
    }
    require(adapter->calls.size() == expected.size(), "an unmounted surface takes no more calls");
    require(loader::native::mountedFabricSurfaces() == 1, "only the kept surface stays mounted");

    auto replacement = facebook::hermes::makeHermesRuntime();
    loader::native::registerRuntime(*replacement);
    require(loader::native::mountedFabricSurfaces() == 0,
            "replacing the runtime forgets its surfaces");
    require(adapter->calls.back() == "unmount surface-2",
            "replacing the runtime unmounts its surfaces");

    std::printf("native fabric: all checks passed on Hermes\n");
    return 0;
}
