#pragma once

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <functional>
#include <jsi/jsi.h>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <thread>

#include "LoaderUpdater.h"
#include "UnboundNativeBridge.h"

namespace loader {
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

    virtual std::optional<std::string> resource(const std::string &name) = 0;
    virtual std::optional<std::string> resolveUpdateURL()                = 0;
    virtual uint32_t                   runtimeBytecodeVersion()          = 0;
    virtual UnboundNativeProvider      unboundNativeProvider()           = 0;

    virtual void installNativeModules(facebook::jsi::Runtime &runtime) = 0;
    virtual void onAddonsPrepared() {}
    virtual void onBundleExecuted() {}
    virtual void alert(const std::string &message) {}
    // An alert about a crash the loader recovered from, offering to open a prefilled report.
    virtual void crashAlert(const std::string &message)
    {
        alert(message);
    }
    // Shown while Discord's launch waits for Unbound's bundle to download.
    virtual void showUpdateProgress(bool showing) {}
    virtual void reload() {}
};

class LoaderPipeline
{
public:
    LoaderPipeline(std::shared_ptr<LoaderHost> host, SettingsStore &settings,
                   BundleUpdater &updater);

    void prepare();
    void onRuntimeCreated(facebook::jsi::Runtime &runtime);

    struct SavedBundle {
        // Source text; empty when `bytecode` maps the file instead.
        std::string                                  bundle;
        std::string                                  path;
        std::shared_ptr<const facebook::jsi::Buffer> bytecode;

        bool empty() const
        {
            return bundle.empty() && (!bytecode || bytecode->size() == 0);
        }
    };

    // Maps Hermes bytecode instead of copying it to the heap; reads source text whole.
    static std::optional<SavedBundle> readSavedBundle(const std::string &path);

    std::optional<SavedBundle> takeSavedBundle();

    bool isBundleReady() const;
    // Whether a newer bundle downloaded this launch and runs at the next restart.
    bool hasStagedBundle() const;

    // Seconds Discord must run after a launch, or after a new bundle runs, to count as healthy.
    static constexpr double kHealthySeconds = 15.0;

    // Counts Discord as healthy now: the app went to the background or is about to reload.
    void markHealthy();

private:
    struct FirstDownload {
        uint64_t                   token     = 0;
        bool                       pending   = false;
        bool                       settled   = false;
        bool                       abandoned = false;
        std::optional<SavedBundle> fallback;
        std::optional<std::string> path;
    };

    void updateInBackground(std::string savedPath, bool hasSaved, bool waitForDownload,
                            uint64_t token);
    bool savedFlavourIsCurrent(const std::string &path) const;
    bool settleFirstDownload(uint64_t token, std::optional<std::string> path);
    std::optional<SavedBundle> awaitFirstDownload(uint64_t token);
    bool evaluate(facebook::jsi::Runtime &runtime, SavedBundle saved, uint64_t token);
    void injectPreBundle(facebook::jsi::Runtime &runtime, const std::string &bundlePath);
    void announceCrashDisabledAddons();
    void guardLaunch();
    void promotePendingBundle();

    std::shared_ptr<LoaderHost> host_;
    SettingsStore              &settings_;
    BundleUpdater              &updater_;
    std::optional<SavedBundle>  saved_;
    std::mutex                  savedMutex_;
    std::atomic_uint64_t        token_{0};
    std::atomic_bool            bundleReady_{false};
    std::atomic_bool            bundleStaged_{false};
    std::atomic_bool            evaluationFailed_{false};
    FirstDownload               firstDownload_;
    std::condition_variable     firstDownloadSettled_;
    std::atomic_bool            launchGuarded_{false};
    std::atomic_bool            launchHealthy_{false};
    std::mutex                  promotionMutex_;
    std::optional<std::string>  pendingPromotion_;
};
}
