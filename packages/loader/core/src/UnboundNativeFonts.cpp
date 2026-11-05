#include "UnboundNativeFonts.h"

#include <functional>
#include <optional>
#include <string>

#include "NativePlatformBridge.h"
#include "NativePluginRuntime.h"

namespace loader {
namespace jsi = facebook::jsi;
using fonts::FontService;

using Work    = std::function<nlohmann::json()>;
using Prepare = std::function<Work(jsi::Runtime &, const jsi::Value *, size_t)>;

static std::string stringArgument(jsi::Runtime &runtime, const jsi::Value *args, size_t count,
                                  size_t index, const std::string &method)
{
    if (index >= count || !args[index].isString())
    {
        throw jsi::JSError(runtime, "fonts." + method + " expects a string argument " +
                                        std::to_string(index + 1));
    }
    return args[index].getString(runtime).utf8(runtime);
}

static nlohmann::json jsonArgument(jsi::Runtime &runtime, const jsi::Value *args, size_t count,
                                   size_t index)
{
    return index < count ? fromJSIValue(runtime, args[index]) : nlohmann::json();
}

static jsi::Function syncMethod(jsi::Runtime &runtime, const char *name, Work read)
{
    return native::makeFunction(runtime, name, 0,
                                [read = std::move(read)](jsi::Runtime &rt, const jsi::Value &,
                                                         const jsi::Value *, size_t) -> jsi::Value {
                                    return toJSIValue(rt, read());
                                });
}

static jsi::Function asyncMethod(jsi::Runtime &runtime, const char *name, unsigned length,
                                 Prepare prepare)
{
    return native::makeFunction(runtime, name, length,
                                [prepare = std::move(prepare)](jsi::Runtime &rt, const jsi::Value &,
                                                               const jsi::Value *args,
                                                               size_t count) -> jsi::Value {
                                    Work work   = prepare(rt, args, count);
                                    auto result = std::make_shared<nlohmann::json>();
                                    return native::executeBackgroundAsynchronously(
                                        rt,
                                        [work = std::move(work), result] {
                                            *result = work();
                                        },
                                        [result](jsi::Runtime &resultRuntime) {
                                            return toJSIValue(resultRuntime, *result);
                                        });
                                });
}

jsi::Object makeFontsBridge(jsi::Runtime &runtime, std::shared_ptr<FontService> service)
{
    jsi::Object bridge(runtime);
    bridge.setProperty(runtime, "list", syncMethod(runtime, "list", [service] {
                           return service->list();
                       }));
    bridge.setProperty(runtime, "listPresets", syncMethod(runtime, "listPresets", [service] {
                           return service->listPresets();
                       }));
    bridge.setProperty(
        runtime, "resolve",
        asyncMethod(runtime, "resolve", 1, [service](jsi::Runtime &rt, auto args, size_t count) {
            const std::string input = stringArgument(rt, args, count, 0, "resolve");
            return Work([service, input] {
                return service->resolve(input);
            });
        }));
    bridge.setProperty(
        runtime, "install",
        asyncMethod(runtime, "install", 2, [service](jsi::Runtime &rt, auto args, size_t count) {
            const std::string    input    = stringArgument(rt, args, count, 0, "install");
            const nlohmann::json variants = jsonArgument(rt, args, count, 1);
            return Work([service, input, variants] {
                return service->install(input, variants);
            });
        }));
    bridge.setProperty(
        runtime, "remove",
        asyncMethod(runtime, "remove", 1, [service](jsi::Runtime &rt, auto args, size_t count) {
            const std::string id = stringArgument(rt, args, count, 0, "remove");
            return Work([service, id] {
                service->remove(id);
                return nlohmann::json();
            });
        }));
    bridge.setProperty(runtime, "setOverride",
                       asyncMethod(runtime, "setOverride", 2,
                                   [service](jsi::Runtime &rt, auto args, size_t count) {
                                       const std::string family =
                                           stringArgument(rt, args, count, 0, "setOverride");
                                       std::optional<std::string> fontId;
                                       if (count > 1 && !args[1].isNull() && !args[1].isUndefined())
                                       {
                                           fontId =
                                               stringArgument(rt, args, count, 1, "setOverride");
                                       }
                                       return Work([service, family, fontId] {
                                           service->setOverride(family, fontId);
                                           return nlohmann::json();
                                       });
                                   }));
    // Synchronous, so a `list()` right after it already groups the families.
    bridge.setProperty(
        runtime, "setTargets",
        native::makeFunction(runtime, "setTargets", 2,
                             [service](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                                       size_t count) -> jsi::Value {
                                 service->setTargets(jsonArgument(rt, args, count, 0),
                                                     jsonArgument(rt, args, count, 1));
                                 return jsi::Value::undefined();
                             }));
    bridge.setProperty(
        runtime, "savePreset",
        asyncMethod(runtime, "savePreset", 1, [service](jsi::Runtime &rt, auto args, size_t count) {
            const nlohmann::json preset = jsonArgument(rt, args, count, 0);
            return Work([service, preset] {
                return service->savePreset(preset);
            });
        }));
    bridge.setProperty(runtime, "applyPreset",
                       asyncMethod(runtime, "applyPreset", 1,
                                   [service](jsi::Runtime &rt, auto args, size_t count) {
                                       const std::string id =
                                           stringArgument(rt, args, count, 0, "applyPreset");
                                       return Work([service, id] {
                                           return service->applyPreset(id);
                                       });
                                   }));
    bridge.setProperty(runtime, "removePreset",
                       asyncMethod(runtime, "removePreset", 1,
                                   [service](jsi::Runtime &rt, auto args, size_t count) {
                                       const std::string id =
                                           stringArgument(rt, args, count, 0, "removePreset");
                                       return Work([service, id] {
                                           service->removePreset(id);
                                           return nlohmann::json();
                                       });
                                   }));
    return bridge;
}
}
