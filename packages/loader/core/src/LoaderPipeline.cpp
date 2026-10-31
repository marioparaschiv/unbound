#include "LoaderPipeline.h"

#include <chrono>

#include "LoaderBootstrap.h"
#include "LoaderCrashGuard.h"
#include "LoaderFiles.h"
#include "LoaderJSI.h"
#include "LoaderLog.h"
#include "LoaderLogFile.h"
#include "NativePlatformBridge.h"

namespace loader {
namespace jsi = facebook::jsi;

static constexpr unsigned kMaximumReadinessAttempts = 200;
static constexpr double   kReadinessRetryDelay      = 0.1;
static constexpr auto     kBundlePreparationTimeout = std::chrono::seconds(40);

LoaderPipeline::LoaderPipeline(std::shared_ptr<LoaderHost> host, UpdaterSettings settings,
                               BundleUpdater &updater)
    : host_(std::move(host)), settings_(std::move(settings)), updater_(updater)
{
    bootstrap::setScriptSource([weak = std::weak_ptr<LoaderHost>(host_)](const std::string &name) {
        auto host = weak.lock();
        return host ? host->resource(name) : std::nullopt;
    });
}

bool LoaderPipeline::isBundleReady() const
{
    return bundleReady_.load();
}

void LoaderPipeline::prepare()
{
    bundleReady_.store(false);
    executionScheduled_.store(false);

    if (!settings_.getBoolean("loader.enabled", true))
    {
        prefetchToken_.fetch_add(1);
        std::lock_guard<std::mutex> lock(pendingMutex_);
        pending_.reset();
        log(LogLevel::Info, LOG_CATEGORY_DEFAULT, "Loader is disabled. Aborting.");
        return;
    }

    host_->onAddonsPrepared();

    prefetchBundle();
}

void LoaderPipeline::prefetchBundle()
{
    uint64_t token   = prefetchToken_.fetch_add(1) + 1;
    auto     pending = std::make_shared<PendingBundle>();
    {
        std::lock_guard<std::mutex> lock(pendingMutex_);
        pending_ = pending;
    }

    std::optional<std::string> updateURL       = host_->resolveUpdateURL();
    uint32_t                   bytecodeVersion = host_->runtimeBytecodeVersion();
    bool                       preferFresh     = settings_.getBoolean("loader.update.hmr", false);

    host_->runInBackground([this, pending, token, updateURL, bytecodeVersion, preferFresh]() {
        auto settle = [&](std::string bundle, std::string path) {
            std::lock_guard<std::mutex> lock(pending->mutex);
            if (pending->settled)
            {
                return;
            }
            pending->bundle  = std::move(bundle);
            pending->path    = std::move(path);
            pending->settled = true;
            pending->ready.notify_all();
        };

        bool signaled = false;
        try
        {
            std::string localPath = updater_.resolveBundlePath();
            if (!preferFresh && fileExists(localPath))
            {
                std::optional<std::string> cached = readTextFile(localPath);
                if (cached && !cached->empty() && token == prefetchToken_.load())
                {
                    settle(std::move(*cached), localPath);
                    signaled = true;
                }
            }

            std::string downloadedPath =
                updater_.downloadBundle(localPath, updateURL, bytecodeVersion);
            if (!signaled && fileExists(downloadedPath) && token == prefetchToken_.load())
            {
                std::optional<std::string> downloaded = readTextFile(downloadedPath);
                if (downloaded && !downloaded->empty())
                {
                    settle(std::move(*downloaded), downloadedPath);
                    signaled = true;
                }
            }
        }
        catch (const std::exception &error)
        {
            bool cached = signaled || fileExists(updater_.resolveBundlePath());
            log(cached ? LogLevel::Warning : LogLevel::Error, LOG_CATEGORY_DEFAULT,
                std::string("Bundle download failed. (") + error.what() + ")" +
                    (cached ? "; using the cached bundle" : ""));
        }

        if (!signaled && preferFresh && token == prefetchToken_.load())
        {
            std::string                localPath = updater_.resolveBundlePath();
            std::optional<std::string> cached =
                fileExists(localPath) ? readTextFile(localPath) : std::nullopt;
            if (cached && !cached->empty())
            {
                settle(std::move(*cached), localPath);
                signaled = true;
            }
        }

        if (!signaled)
        {
            if (token == prefetchToken_.load())
            {
                host_->alert(
                    "Failed to load astral's bundle. Please report this to the developers.");
            }
            settle(std::string(), std::string());
        }
    });
}

void LoaderPipeline::announceCrashDisabledAddons()
{
    std::shared_ptr<NativePlatformProvider> provider = currentNativePlatformProvider();
    if (!provider || provider->documents.empty())
    {
        return;
    }

    for (const CrashedAddon &addon : takeUnannouncedCrashDisabledAddons(provider->documents))
    {
        host_->alert(crashDisabledNotice(addon));
    }
}

void LoaderPipeline::injectPreBundle(jsi::Runtime &runtime)
{
    host_->installNativeModules(runtime);
    installConsoleCapture(runtime);
    announceCrashDisabledAddons();

    if (settings_.getBoolean("loader.devtools", false))
    {
        if (std::optional<std::string> devtools = bootstrap::script(bootstrap::kDevtools))
        {
            log(LogLevel::Info, LOG_CATEGORY_DEFAULT, "Executing DevTools bundle...");
            evaluateScript(runtime, *devtools, "astral:devtools");
        }
    }

    log(LogLevel::Info, LOG_CATEGORY_DEFAULT, "Pre-loading settings, plugins, fonts and themes...");
    auto preload = bootstrap::function(runtime, bootstrap::kPreload);
    if (!preload)
    {
        return;
    }
    try
    {
        preload->call(runtime, toJSIValue(runtime, preloadData(host_->preloadPayload())));
    }
    catch (const std::exception &error)
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT,
            std::string("Pre-loading failed: ") + error.what());
    }
}

void LoaderPipeline::onRuntimeCreated(jsi::Runtime &runtime)
{
    bool captured = installMetroModuleCapture(runtime);
    log(captured ? LogLevel::Info : LogLevel::Error, LOG_CATEGORY_RUNTIME,
        captured ? "Metro module capture installed before Discord bundle."
                 : "Metro module capture could not be installed.");

    bool gated = installRunApplicationGate(runtime, [this](jsi::Runtime &rt) {
        executeNow(rt, kRunApplicationBundleWait);
    });
    log(gated ? LogLevel::Info : LogLevel::Error, LOG_CATEGORY_RUNTIME,
        gated ? "astral will run before Discord's first surface starts."
              : "The run-application gate could not be installed.");
}

void LoaderPipeline::enqueueBundle()
{
    if (executionScheduled_.exchange(true))
    {
        return;
    }

    std::shared_ptr<PendingBundle> pending;
    {
        std::lock_guard<std::mutex> lock(pendingMutex_);
        pending = pending_;
    }
    if (!pending)
    {
        return;
    }

    uint64_t token = prefetchToken_.load();
    host_->runInBackground([this, pending, token]() {
        {
            std::unique_lock<std::mutex> lock(pending->mutex);
            if (!pending->ready.wait_for(lock, kBundlePreparationTimeout, [&] {
                    return pending->settled;
                }))
            {
                log(LogLevel::Error, LOG_CATEGORY_DEFAULT, "Bundle preparation timed out.");
                return;
            }
        }

        if (token != prefetchToken_.load() || pending->bundle.empty())
        {
            return;
        }

        log(LogLevel::Info, LOG_CATEGORY_DEFAULT, "Scheduling astral's bundle for execution...");
        executeBundle(pending, token, 0);
    });
}

void LoaderPipeline::executeBundle(std::shared_ptr<PendingBundle> pending, uint64_t token,
                                   unsigned attempt)
{
    if (token != prefetchToken_.load())
    {
        return;
    }

    host_->runOnRuntime([this, pending, token, attempt](jsi::Runtime &runtime) {
        jsi::Object global    = runtime.global();
        jsi::Value  installed = global.getProperty(runtime, "__loaderBundleInstalled");
        if (installed.isBool() && installed.getBool())
        {
            return;
        }

        if (!runtimeHasRequiredModules(runtime))
        {
            if (attempt == 0)
            {
                log(LogLevel::Info, LOG_CATEGORY_DEFAULT,
                    "React Native module readiness state: " + runtimeModuleDiagnostics(runtime));
            }

            if (attempt >= kMaximumReadinessAttempts)
            {
                log(LogLevel::Error, LOG_CATEGORY_DEFAULT,
                    "React Native modules were not ready after " + std::to_string(attempt) +
                        " attempts.");
                return;
            }

            host_->runAfter(kReadinessRetryDelay, [this, pending, token, attempt]() {
                executeBundle(pending, token, attempt + 1);
            });
            return;
        }

        evaluatePending(runtime, pending, token);
    });
}

std::shared_ptr<LoaderPipeline::PendingBundle> LoaderPipeline::currentPending()
{
    std::lock_guard<std::mutex> lock(pendingMutex_);
    return pending_;
}

bool LoaderPipeline::waitForPreparedBundle(std::chrono::milliseconds wait)
{
    std::shared_ptr<PendingBundle> pending = currentPending();
    if (!pending)
    {
        return false;
    }

    std::unique_lock<std::mutex> lock(pending->mutex);
    return pending->ready.wait_for(lock, wait, [&] {
        return pending->settled;
    }) && !pending->bundle.empty();
}

bool LoaderPipeline::executeNow(jsi::Runtime &runtime, std::chrono::milliseconds wait)
{
    jsi::Value installed = runtime.global().getProperty(runtime, "__loaderBundleInstalled");
    if (installed.isBool() && installed.getBool())
    {
        return true;
    }

    if (!waitForPreparedBundle(wait) || !runtimeHasRequiredModules(runtime))
    {
        return false;
    }

    log(LogLevel::Info, LOG_CATEGORY_DEFAULT, "Executing astral's bundle before the app starts...");
    return evaluatePending(runtime, currentPending(), prefetchToken_.load());
}

bool LoaderPipeline::evaluatePending(jsi::Runtime                         &runtime,
                                     const std::shared_ptr<PendingBundle> &pending, uint64_t token)
{
    jsi::Object global = runtime.global();

    if (!updater_.markBundleAttempted(pending->path))
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT, "Bundle validation marker could not be saved.");
        return false;
    }

    global.setProperty(runtime, "__loaderBundleInstalled", jsi::Value(true));
    injectPreBundle(runtime);

    log(LogLevel::Info, LOG_CATEGORY_DEFAULT, "Attempting to execute bundle...");
    if (!evaluateScript(runtime, pending->bundle, "astral"))
    {
        global.setProperty(runtime, "__loaderBundleInstalled", jsi::Value(false));
        updater_.rejectBundle(pending->path);
        return false;
    }

    if (!updater_.acceptBundle(pending->path))
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT, "Validated bundle could not be promoted.");
    }
    log(LogLevel::Info, LOG_CATEGORY_DEFAULT, "astral's bundle was successfully executed.");
    if (token == prefetchToken_.load())
    {
        bundleReady_.store(true);
        host_->onBundleExecuted();
    }
    return true;
}
}
