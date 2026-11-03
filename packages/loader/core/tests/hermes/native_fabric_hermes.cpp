#include <algorithm>
#include <cstdio>
#include <cstdlib>
#include <hermes/hermes.h>
#include <jsi/jsi.h>
#include <memory>
#include <string>
#include <vector>

#include "LoaderAddonActivity.h"
#include "NativeFabric.h"
#include "NativeLimits.h"
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
        if (holding)
        {
            held.push_back(std::move(work));
            return;
        }
        work();
    }

    void release()
    {
        holding = false;
        std::vector<std::function<void()>> pending;
        pending.swap(held);
        std::vector<std::function<void()>> timers;
        timers.swap(delayed);
        for (const auto &work : pending)
        {
            work();
        }
        for (const auto &work : timers)
        {
            work();
        }
    }

    void runOnRuntime(std::function<void(jsi::Runtime &)>) override {}

    void runAfter(double, std::function<void()> work) override
    {
        if (holding)
        {
            delayed.push_back(std::move(work));
            return;
        }
        work();
    }

    bool                               holding = false;
    std::vector<std::function<void()>> held;
    std::vector<std::function<void()>> delayed;
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

    bool update(const std::string &surface, const nlohmann::json &properties) override
    {
        calls.push_back("update " + surface + " " + properties.dump());
        return updates;
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

    bool detach(const std::string &surface) override
    {
        if (reusable)
        {
            calls.push_back("detach " + surface);
        }
        return reusable;
    }

    bool attach(const std::string &surface, const loader::native::FabricView &container) override
    {
        calls.push_back("attach " + surface + " " + static_cast<const NamedView &>(container).name);
        return reusable;
    }

    bool detachesEverySurface() const override
    {
        return detachesEarly;
    }

    bool postsVoidCalls() const override
    {
        return knowsFrames;
    }

    bool measuresLastSetFrame() const override
    {
        return knowsFrames;
    }

    bool                     reusable      = false;
    bool                     knowsFrames   = false;
    bool                     updates       = true;
    bool                     detachesEarly = false;
    int                      mounted       = 0;
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

static const char *const kReuseChecks = R"JS((function () {
	var first = fabric.mount('row-a', 'Avatar', { user: 1 }, { reuse: true });
	fabric.unmount(first);
	var second = fabric.mount('row-b', 'Avatar', { user: 2 }, { reuse: true });
	var plain = fabric.mount('row-c', 'Avatar', { user: 3 });
	fabric.unmount(plain);
	var extra = [];
	for (var index = 0; index <= perModule; index++) {
		extra.push(fabric.mount('row-x', 'Avatar', {}, { reuse: true }));
	}
	fabric.unmount(second);
	for (var position = 0; position < extra.length; position++) {
		fabric.unmount(extra[position]);
	}
	return 'done';
})())JS";

static const char *const kKnownFrameChecks = R"JS((function () {
	var failures = [];
	function check(condition, message) {
		if (!condition) failures.push(message);
	}
	var surface = fabric.mount('container', 'Card', {});
	var measured = fabric.measure(surface);
	check(measured.x === 5 && measured.height === 8, 'a surface with no set frame is measured');
	check(fabric.setFrame(surface, { x: 1, y: 2, width: 3, height: 4 }) === undefined, 'setFrame returns nothing');
	var known = fabric.measure(surface);
	check(known.x === 1 && known.y === 2 && known.width === 3 && known.height === 4, 'measure serves the last set frame');
	check(fabric.update(surface, { revision: 2 }) === undefined, 'update returns nothing');
	fabric.unmount(surface);
	var gone = fabric.measure(surface);
	check(gone.x === 0 && gone.width === 0, 'an unmounted surface measures empty');
	return JSON.stringify(failures);
})())JS";

static void servesKnownFrames(jsi::Runtime &runtime, RecordingAdapter &adapter)
{
    adapter.knowsFrames = true;
    adapter.calls.clear();
    jsi::Value result = runtime.evaluateJavaScript(
        std::make_shared<jsi::StringBuffer>(kKnownFrameChecks), "native-fabric-known-frames.js");
    nlohmann::json failures = nlohmann::json::parse(result.getString(runtime).utf8(runtime));
    for (const auto &failure : failures)
    {
        std::fprintf(stderr, "%s\n", failure.get<std::string>().c_str());
    }
    require(failures.empty(), "every known frame check passes");

    size_t measured = 0;
    for (const std::string &call : adapter.calls)
    {
        measured += call.rfind("measureSurface ", 0) == 0 ? 1 : 0;
    }
    require(measured == 1, "a known frame is served without measuring on main");
    require(adapter.calls.size() == 5,
            "mount, measure, setFrame, update and unmount reach the adapter");
    require(adapter.calls.back().rfind("unmount ", 0) == 0, "the surface is unmounted last");
    adapter.knowsFrames = false;
}

static size_t countCalls(const RecordingAdapter &adapter, const std::string &prefix)
{
    size_t found = 0;
    for (const std::string &call : adapter.calls)
    {
        found += call.rfind(prefix, 0) == 0 ? 1 : 0;
    }
    return found;
}

static bool called(const RecordingAdapter &adapter, const std::string &call)
{
    return std::find(adapter.calls.begin(), adapter.calls.end(), call) != adapter.calls.end();
}

static void evaluate(jsi::Runtime &runtime, const std::string &source, const char *name)
{
    runtime.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(source), name);
}

static void reusesIdleSurfaces(jsi::Runtime &runtime, RecordingAdapter &adapter)
{
    const size_t perModule = loader::native::kIdleFabricSurfacesPerModule;
    adapter.reusable       = true;
    adapter.calls.clear();
    runtime.global().setProperty(runtime, "perModule", static_cast<double>(perModule));
    loader::AddonScope scope(loader::registerAddonSlot("unbound.reuse", "Reuse"));
    runtime.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(kReuseChecks),
                               "native-fabric-reuse.js");

    auto count = [&](const std::string &prefix) {
        return countCalls(adapter, prefix);
    };
    std::string reusedSurface = "surface-3";
    require(count("attach ") == 1, "a reusable mount reuses the idle surface of its module");
    require(called(adapter, "attach " + reusedSurface + " row-b"),
            "the idle surface is attached to the new container");
    require(called(adapter, "update " + reusedSurface + " {\"user\":2}"),
            "a reused surface receives the new properties");
    require(count("mount ") == perModule + 3, "only mounts with no idle surface create one");
    require(count("unmount ") == 3,
            "a mount without reuse unmounts, and idle surfaces past the module cap are destroyed");
    require(loader::native::idleFabricSurfaces() == perModule,
            "each module keeps at most its cap of idle surfaces");

    {
        loader::AddonScope other(loader::registerAddonSlot("unbound.other", "Other"));
        runtime.evaluateJavaScript(
            std::make_shared<jsi::StringBuffer>(
                "fabric.unmount(fabric.mount('row-g', 'Avatar', {}, { reuse: true }))"),
            "native-fabric-other.js");
    }
    require(loader::native::idleFabricSurfaces() == perModule + 1,
            "another plugin parks its own surface");

    runtime.evaluateJavaScript(std::make_shared<jsi::StringBuffer>("fabric.releaseIdle()"),
                               "native-fabric-release.js");
    require(loader::native::idleFabricSurfaces() == 1,
            "releasing idle surfaces keeps those of other plugins");
    require(count("unmount ") == perModule + 3, "releasing unmounts the plugin's idle surfaces");

    loader::native::evictIdleFabricSurfaces();
    require(loader::native::idleFabricSurfaces() == 0, "eviction destroys every idle surface");
    require(count("unmount ") == perModule + 4, "eviction unmounts the idle surfaces");
    adapter.reusable = false;
}

static void destroysSurfacesThatCannotUpdate(jsi::Runtime &runtime, RecordingAdapter &adapter)
{
    adapter.reusable = true;
    adapter.calls.clear();
    loader::AddonScope scope(loader::registerAddonSlot("unbound.stale", "Stale"));
    size_t             reused = loader::native::reusedFabricSurfaces();
    size_t             missed = loader::native::missedFabricSurfaces();
    evaluate(runtime, "fabric.unmount(fabric.mount('row-a', 'Pill', {}, { reuse: true }))",
             "native-fabric-park.js");
    std::string parked = "surface-" + std::to_string(adapter.mounted);
    adapter.updates    = false;
    evaluate(runtime,
             "globalThis.fresh = fabric.mount('row-b', 'Pill', { id: 2 }, { reuse: true })",
             "native-fabric-stale.js");
    adapter.updates = true;
    require(called(adapter, "attach " + parked + " row-b"), "the idle surface is tried first");
    require(called(adapter, "unmount " + parked),
            "an idle surface that cannot update is destroyed");
    require(called(adapter, "mount row-b Pill {\"id\":2}"), "a fresh surface replaces it");
    require(loader::native::reusedFabricSurfaces() == reused,
            "a failed update is not counted as reuse");
    require(loader::native::missedFabricSurfaces() == missed + 2,
            "both mounts that found no usable idle surface count as misses");
    evaluate(runtime, "fabric.unmount(fresh)", "native-fabric-stale-unmount.js");
    loader::native::evictIdleFabricSurfaces();
    adapter.reusable = false;
}

static void parksBeforeThePostedDetach(jsi::Runtime &runtime, RecordingAdapter &adapter,
                                       InlineExecutor &executor)
{
    adapter.reusable      = true;
    adapter.detachesEarly = true;
    adapter.calls.clear();
    loader::AddonScope scope(loader::registerAddonSlot("unbound.early", "Early"));
    evaluate(runtime,
             "globalThis.pill = fabric.mount('row-a', 'Pill', {}, { reuse: true }); "
             "globalThis.other = fabric.mount('row-b', 'Pill', {}, { reuse: true })",
             "native-fabric-early-mount.js");
    std::string second = "surface-" + std::to_string(adapter.mounted);
    std::string first  = "surface-" + std::to_string(adapter.mounted - 1);
    executor.holding   = true;
    evaluate(runtime,
             "fabric.unmountAsync(pill); fabric.unmountAsync(other); globalThis.next = "
             "fabric.mount('row-c', 'Pill', { id: 3 }, { reuse: true })",
             "native-fabric-early-race.js");
    bool        reusedFirst = called(adapter, "attach " + first + " row-c");
    std::string reused      = reusedFirst ? first : second;
    std::string untouched   = reusedFirst ? second : first;
    require(called(adapter, "attach " + reused + " row-c"),
            "a mount that runs before the posted detach reuses a parked surface");
    require(countCalls(adapter, "mount ") == 2, "no new surface is created for the reuse");
    require(countCalls(adapter, "detach ") == 0, "the posted detaches are still held");
    executor.release();
    require(called(adapter, "detach " + untouched),
            "the posted detach runs for a parked surface that was not reused");
    require(!called(adapter, "detach " + reused),
            "the posted detach skips a surface that was already reused");
    require(loader::native::idleFabricSurfaces() == 1,
            "only the untouched surface stays in the idle pool");

    evaluate(runtime, "fabric.unmount(next)", "native-fabric-early-park.js");
    require(called(adapter, "detach " + reused), "a parked surface unmounted later is detached");
    require(loader::native::idleFabricSurfaces() == 2, "both detached surfaces stay idle");
    loader::native::evictIdleFabricSurfaces();
    adapter.detachesEarly = false;
    adapter.reusable      = false;
}

static void fillIdlePool(jsi::Runtime &runtime, const char *slot)
{
    loader::AddonScope scope(loader::registerAddonSlot(slot, slot));
    evaluate(runtime,
             "(function () { var pills = []; for (var index = 0; index < perModule; index++) "
             "pills.push(fabric.mount('row', 'Pill', {}, { reuse: true })); "
             "pills.forEach(function (pill) { fabric.unmount(pill); }); })()",
             "native-fabric-fill-idle.js");
}

static void evictsIdleSurfacesWhenTheBudgetIsFull(jsi::Runtime &runtime, RecordingAdapter &adapter)
{
    adapter.reusable = true;
    adapter.calls.clear();
    runtime.global().setProperty(runtime, "perModule",
                                 static_cast<double>(loader::native::kIdleFabricSurfacesPerModule));
    fillIdlePool(runtime, "unbound.idle-a");
    fillIdlePool(runtime, "unbound.idle-b");
    require(loader::native::idleFabricSurfaces() == loader::native::kIdleFabricSurfaces,
            "two plugins fill the idle pool");

    size_t freeSlots = loader::native::kMaximumMountedSurfaces -
                       loader::native::mountedFabricSurfaces() -
                       loader::native::idleFabricSurfaces();
    size_t liveSlots =
        loader::native::kMaximumMountedSurfaces - loader::native::mountedFabricSurfaces();
    runtime.global().setProperty(runtime, "liveSlots", static_cast<double>(liveSlots));
    evaluate(runtime,
             "globalThis.live = []; for (var index = 0; index < liveSlots; index++) "
             "live.push(fabric.mount('row', 'Card', {}))",
             "native-fabric-fill-budget.js");
    require(loader::native::idleFabricSurfaces() == 0,
            "live mounts evict idle surfaces once the budget is full");
    require(countCalls(adapter, "unmount ") == liveSlots - freeSlots,
            "each mount past the free slots destroys exactly one idle surface");

    jsi::Value overflow = runtime.evaluateJavaScript(
        std::make_shared<jsi::StringBuffer>(
            "(function () { try { fabric.mount('row', 'Card', {}); return false; } "
            "catch (error) { return true; } })()"),
        "native-fabric-overflow.js");
    require(overflow.isBool() && overflow.getBool(),
            "a mount still fails when only live surfaces hold the budget");

    evaluate(runtime, "live.forEach(function (surface) { fabric.unmount(surface); })",
             "native-fabric-drain-budget.js");
    adapter.reusable = false;
}

int main()
{
    auto executor = std::make_shared<InlineExecutor>();
    loader::native::setExecutor(executor);
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

    reusesIdleSurfaces(*runtime, *adapter);
    require(loader::native::mountedFabricSurfaces() == 1, "reuse leaves only the kept surface");

    destroysSurfacesThatCannotUpdate(*runtime, *adapter);
    require(loader::native::mountedFabricSurfaces() == 1,
            "failed reuse leaves only the kept surface");

    parksBeforeThePostedDetach(*runtime, *adapter, *executor);
    require(loader::native::mountedFabricSurfaces() == 1,
            "early parking leaves only the kept surface");

    evictsIdleSurfacesWhenTheBudgetIsFull(*runtime, *adapter);
    require(loader::native::mountedFabricSurfaces() == 1,
            "budget eviction leaves only the kept surface");

    servesKnownFrames(*runtime, *adapter);
    require(loader::native::mountedFabricSurfaces() == 1,
            "known frames leave only the kept surface");

    auto replacement = facebook::hermes::makeHermesRuntime();
    loader::native::registerRuntime(*replacement);
    require(loader::native::mountedFabricSurfaces() == 0,
            "replacing the runtime forgets its surfaces");
    require(adapter->calls.back() == "unmount surface-2",
            "replacing the runtime unmounts its surfaces");

    std::printf("native fabric: all checks passed on Hermes\n");
    return 0;
}
