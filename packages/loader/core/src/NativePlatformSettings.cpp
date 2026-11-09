#include "NativePlatformSettings.h"

#include "NativePlatformBridge.h"
#include "NativePluginRuntime.h"

namespace loader {
namespace jsi = facebook::jsi;

jsi::Object settingsBridge(jsi::Runtime &runtime, SettingsStore *store)
{
    jsi::Object settings(runtime);
    settings.setProperty(
        runtime, "apply",
        native::makeFunction(
            runtime, "apply", 1,
            [store](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                    size_t count) -> jsi::Value {
                if (count == 0 || !args[0].isObject() || !args[0].asObject(rt).isArray(rt))
                {
                    throw jsi::JSError(rt, "settings.apply expects an array of changes");
                }
                return jsi::Value(store->apply(fromJSIValue(rt, args[0])));
            }));
    settings.setProperty(
        runtime, "stage",
        native::makeFunction(
            runtime, "stage", 1,
            [store](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                    size_t count) -> jsi::Value {
                if (count == 0 || !args[0].isObject() || !args[0].asObject(rt).isArray(rt))
                {
                    throw jsi::JSError(rt, "settings.stage expects an array of changes");
                }
                return jsi::Value(store->stage(fromJSIValue(rt, args[0])));
            }));
    settings.setProperty(runtime, "flush",
                         native::makeFunction(runtime, "flush", 0,
                                              [store](jsi::Runtime &, const jsi::Value &,
                                                      const jsi::Value *, size_t) -> jsi::Value {
                                                  return jsi::Value(store->flush());
                                              }));
    settings.setProperty(
        runtime, "get",
        native::makeFunction(
            runtime, "get", 2,
            [store](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                    size_t count) -> jsi::Value {
                if (count == 0 || args[0].isUndefined())
                {
                    return toJSIValue(rt, store->snapshot());
                }
                if (!args[0].isString() ||
                    (count > 1 && !args[1].isUndefined() && !args[1].isString()))
                {
                    throw jsi::JSError(rt, "settings.get expects a store name and a key path");
                }
                const std::string key =
                    count > 1 && args[1].isString() ? args[1].getString(rt).utf8(rt) : "";
                // Converts in place: copying a large store first would double the work.
                jsi::Value result = jsi::Value::undefined();
                store->read(args[0].getString(rt).utf8(rt), key, [&](const nlohmann::json &value) {
                    result = toJSIValue(rt, value);
                });
                return result;
            }));
    return settings;
}
}
