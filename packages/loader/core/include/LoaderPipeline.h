#pragma once

#include <atomic>
#include <functional>
#include <jsi/jsi.h>
#include <memory>
#include <mutex>
#include <optional>
#include <string>

#include "LoaderPreload.h"
#include "LoaderUpdater.h"

namespace loader {
class LoaderHost
{
public:
    virtual ~LoaderHost() = default;

    virtual void runInBackground(std::function<void()> work) = 0;

    virtual std::optional<std::string> resource(const std::string &name) = 0;
    virtual std::optional<std::string> resolveUpdateURL()                = 0;
    virtual uint32_t                   runtimeBytecodeVersion()          = 0;
    virtual PreloadPayload             preloadPayload()                  = 0;

    virtual void installNativeModules(facebook::jsi::Runtime &runtime) = 0;
    virtual void onAddonsPrepared() {}
    virtual void onBundleExecuted() {}
    virtual void alert(const std::string &message) {}
    virtual void reload() {}
};

class LoaderPipeline
{
public:
    LoaderPipeline(std::shared_ptr<LoaderHost> host, UpdaterSettings settings,
                   BundleUpdater &updater);

    void prepare();
    void onRuntimeCreated(facebook::jsi::Runtime &runtime);

    bool isBundleReady() const;

private:
    struct SavedBundle {
        std::string bundle;
        std::string path;
    };

    void updateInBackground(std::string savedPath, bool hasSaved, uint64_t token);
    bool evaluate(facebook::jsi::Runtime &runtime, const SavedBundle &saved, uint64_t token);
    void injectPreBundle(facebook::jsi::Runtime &runtime);
    void announceCrashDisabledAddons();

    std::shared_ptr<LoaderHost> host_;
    UpdaterSettings             settings_;
    BundleUpdater              &updater_;
    std::optional<SavedBundle>  saved_;
    std::mutex                  savedMutex_;
    std::atomic_uint64_t        token_{0};
    std::atomic_bool            bundleReady_{false};
    std::atomic_bool            evaluationFailed_{false};
};
}
