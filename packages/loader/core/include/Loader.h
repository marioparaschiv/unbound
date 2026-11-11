#pragma once

#include <cstdint>
#include <jsi/jsi.h>
#include <memory>
#include <mutex>
#include <nlohmann/json.hpp>
#include <optional>
#include <string>

#include "LoaderAddons.h"
#include "LoaderFontService.h"
#include "LoaderHost.h"
#include "LoaderHotReload.h"
#include "LoaderPipeline.h"
#include "LoaderSettings.h"
#include "LoaderToolbox.h"
#include "LoaderUpdater.h"
#include "NativePlatformBridge.h"

namespace loader {
struct LoaderOptions {
    // Unbound's folder.
    std::string documents;
    // The platform as the toolbox and issue reports name it: "Android" or "iOS".
    std::string platform;
    // The native library or dylib the loader runs from, as `UnboundNative.getLoader` reports it.
    std::string origin;
};

// The loader as every platform runs it: its settings, bundle updater and pipeline, addons, fonts,
// hot reload and toolbox, wired once over a platform's `LoaderHost`. Create it with
// `std::make_shared` and call `start` before anything else.
class Loader : public std::enable_shared_from_this<Loader>
{
public:
    // `provider` holds the platform's facts; the loader fills in its documents, settings and fonts.
    Loader(LoaderOptions options, std::shared_ptr<LoaderHost> host,
           std::shared_ptr<NativePlatformProvider> provider);

    // Loads settings and builds the updater, pipeline, fonts and hot reload. Publishes the platform
    // provider for `currentDebugEnvironment`.
    void start();
    // Reads the installed addons' manifests ahead of the runtime, so the first scan is quick.
    void prescanAddons();
    // Discord is about to read its bundle: rereads settings changed since `start`, then prepares
    // Unbound's bundle. Call before `onRuntimeCreated`.
    void prepare();
    // The runtime exists and Discord's bundle has not run: runs Unbound's first.
    void onRuntimeCreated(facebook::jsi::Runtime &runtime);
    // Counts Discord as healthy now: the app went to the background or is about to reload.
    void markHealthy();
    // Discord returned to the foreground: checks for a newer bundle if one is due.
    void onForeground();

    SettingsStore                       &settings();
    BundleUpdater                       &updater();
    AddonState                          &addons();
    std::shared_ptr<fonts::FontService>  fonts();
    std::shared_ptr<HotReloadController> hotReload();
    const std::string                   &documents() const;
    bool                                 isBundleReady() const;
    // Every font a plugin can pick: the downloaded ones, then the device's and Discord's.
    nlohmann::json fontCatalog();
    // The JSON overrides target for `family`, or "{}" when it has none.
    std::string resolveFont(const std::string &family);
    // The colours of an installed theme by accessor, or an empty object.
    nlohmann::json themeColors(const std::string &themeId);

    toolbox::ToolboxContext toolboxContext();
    std::string             toolbox(const std::string &action, const std::string &argument);

    // The dev server or custom bundle URL, else none for the default.
    std::optional<std::string> resolveUpdateURL();
    uint32_t                   runtimeBytecodeVersion();
    // `UnboundNative` as the client sees it: the core members plus the platform's.
    UnboundNativeProvider unboundNativeProvider();
    void                  installNativeModules(facebook::jsi::Runtime &runtime);
    void                  onAddonsPrepared();
    void                  onBundleExecuted();
    LoaderHost           &host();

private:
    class Pipeline;

    const nlohmann::json &systemFonts();

    LoaderOptions                           options_;
    std::shared_ptr<LoaderHost>             host_;
    std::shared_ptr<NativePlatformProvider> provider_;
    SettingsStore                           settings_;
    std::unique_ptr<BundleUpdater>          updater_;
    std::unique_ptr<LoaderPipeline>         pipeline_;
    std::shared_ptr<HotReloadController>    hotReload_;
    std::shared_ptr<fonts::FontService>     fonts_;
    AddonState                              addons_;
    std::mutex                              systemFontsMutex_;
    std::optional<nlohmann::json>           systemFonts_;
};
}
