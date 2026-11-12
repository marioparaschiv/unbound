#include <cstring>
#include <exception>
#include <jsi/instrumentation.h>
#include <mutex>

#include "LoaderJSIJSON.h"
#include "LoaderLog.h"
#include "NativePlatformBridge.h"
#include "NativePluginRuntime.h"

namespace loader::native {
namespace jsi = facebook::jsi;

static std::mutex            gUIGarbageCollectorMutex;
static std::function<bool()> gUIGarbageCollector;

void setUIRuntimeGarbageCollector(std::function<bool()> collector)
{
    std::lock_guard<std::mutex> lock(gUIGarbageCollectorMutex);
    gUIGarbageCollector = std::move(collector);
}

static bool collectUIRuntimeGarbage()
{
    std::function<bool()> collector;
    {
        std::lock_guard<std::mutex> lock(gUIGarbageCollectorMutex);
        collector = gUIGarbageCollector;
    }
    if (!collector)
    {
        return false;
    }
    try
    {
        return collector();
    }
    catch (const std::exception &error)
    {
        log(LogLevel::Error, LOG_CATEGORY_PLUGINS,
            std::string("Collecting UI runtime garbage failed: ") + error.what());
    }
    catch (...)
    {
        log(LogLevel::Error, LOG_CATEGORY_PLUGINS, "Collecting UI runtime garbage failed");
    }
    return false;
}

static nlohmann::json collectGarbage(const std::function<void()> &collectRuntime)
{
    collectRuntime();
    return {{"runtime", true}, {"uiRuntime", collectUIRuntimeGarbage()}};
}

nlohmann::json collectGarbage(jsi::Runtime &runtime)
{
    return collectGarbage([&runtime] {
        runtime.instrumentation().collectGarbage("unbound debug");
    });
}

nlohmann::json debugEnvironmentSnapshot(const DebugEnvironmentOptions &options,
                                        const std::function<void()>   &collectRuntime)
{
    std::optional<nlohmann::json> collected;
    if (options.collectGarbage)
    {
        collected = collectGarbage(collectRuntime);
    }
    nlohmann::json environment = currentDebugEnvironment();
    if (collected)
    {
        environment["garbageCollection"] = std::move(*collected);
    }
    if (options.resetCounters)
    {
        resetMainWorkCounts();
    }
    return environment;
}

static bool optionEnabled(jsi::Runtime &runtime, const jsi::Object &options, const char *name)
{
    jsi::Value value = options.getProperty(runtime, name);
    return value.isBool() && value.getBool();
}

jsi::Value readDebugEnvironment(jsi::Runtime &runtime, const jsi::Value *args, size_t count)
{
    DebugEnvironmentOptions options;
    if (count > 0 && args[0].isObject())
    {
        jsi::Object requested  = args[0].asObject(runtime);
        options.collectGarbage = optionEnabled(runtime, requested, "collectGarbage");
        options.resetCounters  = optionEnabled(runtime, requested, "resetCounters");
    }
    return toJSIValue(runtime, debugEnvironmentSnapshot(options, [&runtime] {
                          runtime.instrumentation().collectGarbage("unbound debug");
                      }));
}
}
