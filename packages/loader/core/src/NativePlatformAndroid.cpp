#include "NativePlatformAndroid.h"

#include <stdexcept>

#include "LoaderJSIJSON.h"
#include "NativePluginRuntime.h"

namespace loader {
namespace jsi = facebook::jsi;

using Installer =
    std::function<std::optional<std::string>(const std::string &, const std::string &)>;

static nlohmann::json installerJSON(const Installer &installer, const char *action,
                                    const std::string &argument = std::string())
{
    std::optional<std::string> text = installer(action, argument);
    if (!text)
    {
        throw std::runtime_error(std::string("Failed to run installer action ") + action);
    }
    return nlohmann::json::parse(*text, nullptr, false);
}

static jsi::Function installerGetter(jsi::Runtime &runtime, const char *name, const char *action,
                                     Installer installer)
{
    return native::makeFunction(
        runtime, name, 0,
        [installer = std::move(installer), action](jsi::Runtime &rt, const jsi::Value &,
                                                   const jsi::Value *, size_t) -> jsi::Value {
            try
            {
                return toJSIValue(rt, installerJSON(installer, action));
            }
            catch (const std::exception &error)
            {
                throw jsi::JSError(rt, error.what());
            }
        });
}

jsi::Object androidPlatformObject(jsi::Runtime                           &runtime,
                                  std::shared_ptr<NativePlatformProvider> provider)
{
    Installer   installer = provider->androidInstaller;
    jsi::Object object(runtime);

    object.setProperty(runtime, "status", installerGetter(runtime, "status", "status", installer));
    object.setProperty(runtime, "progress",
                       installerGetter(runtime, "progress", "progress", installer));
    object.setProperty(
        runtime, "requestPermission",
        installerGetter(runtime, "requestPermission", "request-permission", installer));
    object.setProperty(runtime, "cancel", installerGetter(runtime, "cancel", "cancel", installer));

    // Hashing the installed APKs reads hundreds of megabytes, so it runs off the JavaScript thread.
    object.setProperty(runtime, "installedSplits",
                       native::makeFunction(runtime, "installedSplits", 0,
                                            [installer](jsi::Runtime &rt, const jsi::Value &,
                                                        const jsi::Value *, size_t) -> jsi::Value {
                                                auto hashes = std::make_shared<nlohmann::json>();
                                                return native::executeBackgroundAsynchronously(
                                                    rt,
                                                    [installer, hashes] {
                                                        *hashes = installerJSON(installer,
                                                                                "installed-splits");
                                                    },
                                                    [hashes](jsi::Runtime &resultRuntime) {
                                                        return toJSIValue(resultRuntime, *hashes);
                                                    });
                                            }));

    object.setProperty(
        runtime, "install",
        native::makeFunction(
            runtime, "install", 1,
            [installer](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                        size_t count) -> jsi::Value {
                if (count == 0 || !args[0].isObject() || !args[0].asObject(rt).isArray(rt))
                {
                    throw jsi::JSError(rt, "install expects the build's splits as an array");
                }
                std::optional<std::string> started =
                    installer("install", fromJSIValue(rt, args[0]).dump());
                if (!started)
                {
                    throw jsi::JSError(
                        rt, "Failed to start installing the build: its splits are invalid");
                }
                return jsi::Value(*started == "true");
            }));

    jsi::Object android(runtime);
    android.setProperty(runtime, "installer", std::move(object));
    return android;
}
}
