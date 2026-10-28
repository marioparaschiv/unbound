#include <cstdio>
#include <cstdlib>
#include <hermes/hermes.h>
#include <jsi/instrumentation.h>
#include <jsi/jsi.h>
#include <map>
#include <memory>
#include <string>

#include "NativeHandleLeases.h"
#include "NativePluginRuntime.h"

namespace jsi = facebook::jsi;

static void require(bool condition, const std::string &check)
{
    if (!condition)
    {
        std::fprintf(stderr, "native handle lease check failed: %s\n", check.c_str());
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

static std::optional<std::string> taggedHandle(const nlohmann::json &value)
{
    if (value.value("type", "") == "handle" && value.contains("value") &&
        value["value"].is_string())
    {
        return value["value"].get<std::string>();
    }
    return std::nullopt;
}

static void collect(jsi::Runtime &runtime)
{
    runtime.instrumentation().collectGarbage("native handle lease checks");
}

int main()
{
    loader::native::setExecutor(std::make_shared<InlineExecutor>());
    auto runtime = facebook::hermes::makeHermesRuntime();
    loader::native::registerRuntime(*runtime);

    std::map<std::string, uint64_t> released;
    loader::native::HandleLeases leases(taggedHandle, [&](const std::string &id, uint64_t issues) {
        released[id] += issues;
    });

    nlohmann::json result = {
        {"self", {{"type", "handle"}, {"value", "java-1"}}},
        {"args", nlohmann::json::array({{{"type", "handle"}, {"value", "java-2"}},
                                        {{"type", "handle"}, {"value", "java-1"}},
                                        {{"type", "int"}, {"value", 7}}})},
    };
    runtime->global().setProperty(*runtime, "event", leases.adopt(*runtime, result));
    require(leases.liveHandles() == 2, "two distinct handles are leased");

    jsi::Value shape = runtime->evaluateJavaScript(
        std::make_shared<jsi::StringBuffer>(
            "JSON.stringify([event.self, event.args[0].value, event.args[2], 'value' in event.self])"),
        "shape.js");
    require(shape.getString(*runtime).utf8(*runtime) ==
                R"([{"type":"handle","value":"java-1"},"java-2",{"type":"int","value":7},true])",
            "leased handles keep their plain shape");

    runtime->evaluateJavaScript(std::make_shared<jsi::StringBuffer>(
                                    "globalThis.kept = event.args[1]; delete globalThis.event;"),
                                "drop.js");
    collect(*runtime);
    require(released.count("java-2") == 1 && released["java-2"] == 1,
            "a handle nothing references is released with its one issue");
    require(released.count("java-1") == 0, "a handle JS still holds is kept");

    runtime->evaluateJavaScript(std::make_shared<jsi::StringBuffer>("delete globalThis.kept;"),
                                "drop-kept.js");
    collect(*runtime);
    require(released["java-1"] == 2, "a handle issued twice is released once with both issues");
    require(leases.liveHandles() == 0, "no handles stay leased");

    runtime->global().setProperty(
        *runtime, "stale", leases.adopt(*runtime, {{"type", "handle"}, {"value", "java-3"}}));
    auto replacement = facebook::hermes::makeHermesRuntime();
    loader::native::registerRuntime(*replacement);
    runtime->global().setProperty(*runtime, "stale", jsi::Value::undefined());
    collect(*runtime);
    require(released.count("java-3") == 0,
            "a handle from a replaced runtime is not released again after the platform dropped it");

    std::printf("native handle leases: all checks passed on Hermes\n");
    return 0;
}
