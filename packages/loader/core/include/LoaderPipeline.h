#pragma once

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <functional>
#include <memory>
#include <mutex>
#include <optional>
#include <string>

#include <jsi/jsi.h>

#include "LoaderPreload.h"
#include "LoaderUpdater.h"

namespace loader
{
    class LoaderHost
    {
    public:
        virtual ~LoaderHost() = default;

        virtual void runOnRuntime(std::function<void(facebook::jsi::Runtime &)> work) = 0;
        virtual void runAfter(double seconds, std::function<void()> work) = 0;
        virtual void runInBackground(std::function<void()> work) = 0;

        virtual std::optional<std::string> resource(const std::string &name) = 0;
        virtual std::optional<std::string> resolveUpdateURL() = 0;
        virtual uint32_t runtimeBytecodeVersion() = 0;
        virtual PreloadPayload preloadPayload() = 0;

        virtual void installNativeModules(facebook::jsi::Runtime &runtime) = 0;
        virtual void onAddonsPrepared() {}
        virtual void onBundleExecuted() {}
        virtual void alert(const std::string &message) {}
    };

    class LoaderPipeline
    {
    public:
        LoaderPipeline(std::shared_ptr<LoaderHost> host, UpdaterSettings settings, BundleUpdater &updater);

        void prepare();
        void enqueueBundle();
        bool executeNow(facebook::jsi::Runtime &runtime, std::chrono::milliseconds wait);
        bool waitForPreparedBundle(std::chrono::milliseconds wait);

        bool isBundleReady() const;

    private:
        struct PendingBundle
        {
            std::mutex              mutex;
            std::condition_variable ready;
            bool                    settled = false;
            std::string             bundle;
            std::string             path;
        };

        void prefetchBundle();
        void executeBundle(std::shared_ptr<PendingBundle> pending, uint64_t token, unsigned attempt);
        bool evaluatePending(facebook::jsi::Runtime &runtime, const std::shared_ptr<PendingBundle> &pending,
                             uint64_t token);
        std::shared_ptr<PendingBundle> currentPending();
        void injectPreBundle(facebook::jsi::Runtime &runtime);

        std::shared_ptr<LoaderHost>    host_;
        UpdaterSettings                settings_;
        BundleUpdater                 &updater_;
        std::shared_ptr<PendingBundle> pending_;
        std::mutex                     pendingMutex_;
        std::atomic_uint64_t           prefetchToken_{0};
        std::atomic_bool               executionScheduled_{false};
        std::atomic_bool               bundleReady_{false};
    };
}
