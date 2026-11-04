#include "UnboundNativeBridge.h"

#include <memory>
#include <optional>
#include <utility>

#include "LoaderVersion.h"
#include "NativePlatformBridge.h"
#include "NativePluginRuntime.h"

namespace loader {
namespace jsi = facebook::jsi;

UnboundNativeProvider makeUnboundNativeProvider(const AddonState               &addons,
                                                std::function<nlohmann::json()> availableFonts,
                                                std::string origin, uint32_t bytecodeVersion)
{
    UnboundNativeProvider provider;
    provider.getLoader = [origin = std::move(origin), bytecodeVersion]() -> nlohmann::json {
        return {
            {"origin", origin}, {"version", loaderVersion()}, {"bytecodeVersion", bytecodeVersion}};
    };
    provider.getPlugins = [&addons] {
        return addons.plugins();
    };
    provider.getThemes = [&addons] {
        return addons.themes();
    };
    provider.getFonts = [&addons] {
        return addons.fonts();
    };
    provider.getAvailableFonts = std::move(availableFonts);
    return provider;
}

static jsi::Function getter(jsi::Runtime &runtime, const char *name,
                            std::function<nlohmann::json()> read, nlohmann::json fallback)
{
    return native::makeFunction(
        runtime, name, 0,
        [read = std::move(read), fallback = std::move(fallback)](
            jsi::Runtime &rt, const jsi::Value &, const jsi::Value *, size_t) -> jsi::Value {
            return toJSIValue(rt, read ? read() : fallback);
        });
}

static std::function<nlohmann::json()> cachedOnce(std::function<nlohmann::json()> read)
{
    if (!read)
    {
        return read;
    }
    auto cache = std::make_shared<std::optional<nlohmann::json>>();
    return [read = std::move(read), cache] {
        if (!*cache)
        {
            *cache = read();
        }
        return **cache;
    };
}

void installUnboundNative(jsi::Runtime &runtime, UnboundNativeProvider provider)
{
    const nlohmann::json none = nlohmann::json::array();
    jsi::Object          bridge(runtime);
    bridge.setProperty(
        runtime, "getLoader",
        getter(runtime, "getLoader", std::move(provider.getLoader), nlohmann::json::object()));
    bridge.setProperty(runtime, "getPlugins",
                       getter(runtime, "getPlugins", std::move(provider.getPlugins), none));
    bridge.setProperty(runtime, "getThemes",
                       getter(runtime, "getThemes", std::move(provider.getThemes), none));
    bridge.setProperty(runtime, "getFonts",
                       getter(runtime, "getFonts", std::move(provider.getFonts), none));
    bridge.setProperty(runtime, "getAvailableFonts",
                       getter(runtime, "getAvailableFonts",
                              cachedOnce(std::move(provider.getAvailableFonts)), none));
    runtime.global().setProperty(runtime, "UnboundNative", std::move(bridge));
}
}
