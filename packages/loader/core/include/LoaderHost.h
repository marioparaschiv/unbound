#pragma once

#include <chrono>
#include <functional>
#include <jsi/jsi.h>
#include <map>
#include <memory>
#include <nlohmann/json.hpp>
#include <optional>
#include <string>
#include <thread>

#include "LoaderHotReload.h"
#include "LoaderLaunchGuard.h"
#include "LoaderTransport.h"
#include "UnboundNativeBridge.h"

namespace loader {
// What a platform supplies to the core `Loader`: scheduling, transport, its native modules and its
// UI. Everything else about running the loader is the same on every platform and lives in `Loader`.
class LoaderHost
{
public:
    virtual ~LoaderHost() = default;

    virtual void runInBackground(std::function<void()> work) = 0;
    // Runs `work` off the main thread once `seconds` have passed.
    virtual void runAfter(double seconds, std::function<void()> work)
    {
        runInBackground([seconds, work = std::move(work)]() {
            std::this_thread::sleep_for(std::chrono::duration<double>(seconds));
            work();
        });
    }

    // A bootstrap script packaged with the loader.
    virtual std::optional<std::string> resource(const std::string &name) = 0;
    // The Hermes bytecode version Discord's runtime runs.
    virtual uint32_t runtimeBytecodeVersion() = 0;

    virtual std::optional<std::string> fetchText(const std::string &url, double timeoutSeconds) = 0;
    virtual std::optional<DownloadResult>
    download(const std::string &url, const std::string &destination,
             const std::map<std::string, std::string> &headers, const DownloadPolicy &policy) = 0;
    virtual void collectBackgroundDownload(const std::string &) {}
    virtual void continueDownloadInBackground(const std::string &, const std::string &,
                                              const std::map<std::string, std::string> &)
    {
    }
    // Whether a dev server answers at `url`.
    virtual bool isServing(const std::string &url, double timeoutSeconds) = 0;
    // The host a virtual device's dev server runs on, when there is one.
    virtual std::optional<std::string> devServerHost() = 0;
    // The hot reload stream's connection; none leaves hot reload off.
    virtual std::shared_ptr<HotReloadTransport> hotReloadTransport()
    {
        return nullptr;
    }

    // The fonts installed on the device and in Discord, as `fontEntryFromData` entries. Read once.
    virtual nlohmann::json systemFonts()
    {
        return nlohmann::json::array();
    }
    // The font overrides changed; text laid out from now on should use the new table.
    virtual void onFontsChanged() {}
    // The themes were rescanned; recolour native views with the selected one.
    virtual void onThemesRescanned() {}

    virtual void installNativeModules(facebook::jsi::Runtime &runtime) = 0;
    // Adds the platform's own `UnboundNative` members, such as app icons.
    virtual void extendNativeProvider(UnboundNativeProvider &provider) {}
    virtual void onAddonsPrepared() {}
    virtual void onBundleExecuted() {}

    virtual void alert(const std::string &message) {}
    // An alert about a crash the loader recovered from, offering to open a prefilled report.
    virtual void crashAlert(const std::string &message)
    {
        alert(message);
    }
    // How the previous process ended, where the platform keeps a record of it.
    virtual void stuckLaunch(const std::string &message) {}

    virtual PreviousExit previousExit()
    {
        return PreviousExit::Unknown;
    }
    virtual bool tracksVisibility()
    {
        return false;
    }
    virtual bool visibleNow()
    {
        return false;
    }
    // Whether the active network is metered (mobile data, a hotspot or Low Data Mode).
    virtual bool onMeteredNetwork()
    {
        return false;
    }
    // Shown while Discord's launch waits for Unbound's bundle to download.
    virtual void showUpdateProgress(bool showing) {}
    virtual void reload() {}
};
}
