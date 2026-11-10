#include "LoaderPipeline.h"

#include "HermesBytecodeHeader.h"
#include "HermesSampling.h"
#include "LoaderBootstrap.h"
#include "LoaderCrashGuard.h"
#include "LoaderCrashReport.h"
#include "LoaderFiles.h"
#include "LoaderJSI.h"
#include "LoaderLaunchGuard.h"
#include "LoaderLog.h"
#include "LoaderLogFile.h"
#include "LoaderVersion.h"
#include "NativePlatformBridge.h"

namespace loader {
namespace jsi = facebook::jsi;

static constexpr std::chrono::seconds kFirstDownloadWait{10};

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

bool LoaderPipeline::hasStagedBundle() const
{
    return bundleStaged_.load();
}

void LoaderPipeline::prepare()
{
    // Hosts call this once Discord's runtime exists, before addons load for it; smoke timing starts
    // here.
    log(LogLevel::Info, LOG_CATEGORY_RUNTIME, "Discord's runtime was created.");
    native::noteRuntimeCreated();
    bundleReady_.store(false);
    bundleStaged_.store(false);
    uint64_t token = token_.fetch_add(1) + 1;
    {
        std::lock_guard<std::mutex> lock(savedMutex_);
        saved_.reset();
        firstDownload_ = FirstDownload{token};
    }

    if (!settings_.getBoolean("loader.enabled", true))
    {
        log(LogLevel::Info, LOG_CATEGORY_DEFAULT, "Loader is disabled. Aborting.");
        return;
    }

    // A reload means the bundle that ran survived until something chose to restart it.
    promotePendingBundle();
    guardLaunch();

    host_->onAddonsPrepared();

    std::string savedPath;
    try
    {
        savedPath = updater_.resolveBundlePath();
    }
    catch (const std::exception &error)
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT,
            std::string("Failed to resolve the saved bundle: ") + error.what());
    }

    // A local read, so the bundle can run before Discord's without waiting on the network.
    std::optional<SavedBundle> bundle =
        !savedPath.empty() && fileExists(savedPath) ? readSavedBundle(savedPath) : std::nullopt;
    bool hasSaved = bundle && !bundle->empty();
    // A saved bundle from the other flavour runs at the next launch anyway, so this launch waits
    // for its replacement rather than leaving the switch to a second restart.
    bool flavourSwitch = hasSaved && !savedFlavourIsCurrent(savedPath);
    // The first launch after a loader update waits too, as the bundle this loader can now run would
    // otherwise need a second restart.
    bool loaderChanged =
        hasSaved && settings_.getString(kCheckedLoaderSetting, "") != loaderVersion();
    // Hot reload waits for the newest bundle too: reloading once it lands would tear the runtime
    // down while Discord's bundle is still starting its native modules.
    bool hotReload       = settings_.getBoolean("loader.update.hmr", false);
    bool waitForDownload = !hasSaved || flavourSwitch || loaderChanged || hotReload;
    {
        std::lock_guard<std::mutex> lock(savedMutex_);
        if (hasSaved && waitForDownload)
        {
            firstDownload_.fallback = std::move(*bundle);
        }
        else if (hasSaved)
        {
            saved_ = std::move(*bundle);
        }
        if (waitForDownload)
        {
            firstDownload_.pending = true;
        }
    }

    updateInBackground(savedPath, hasSaved, waitForDownload, token);
}

std::optional<LoaderPipeline::SavedBundle> LoaderPipeline::readSavedBundle(const std::string &path)
{
    std::shared_ptr<MappedFileBuffer> mapped = MappedFileBuffer::map(path);
    if (mapped && isHermesBytecode(mapped->data(), mapped->size()))
    {
        return SavedBundle{"", path, std::move(mapped)};
    }
    std::optional<std::string> source = readTextFile(path);
    if (!source)
    {
        return std::nullopt;
    }
    return SavedBundle{std::move(*source), path, nullptr};
}

bool LoaderPipeline::savedFlavourIsCurrent(const std::string &path) const
{
    std::optional<bool> downloadedFor = updater_.recordedDeveloperMode(path);
    return !downloadedFor || *downloadedFor == updater_.developerMode();
}

// Downloads the newest bundle for the next runtime. With no saved bundle, or with
// `loader.update.hmr`, the runtime waits for it; if that wait gives up, reloads once it arrives.
void LoaderPipeline::updateInBackground(std::string savedPath, bool hasSaved, bool waitForDownload,
                                        uint64_t token)
{
    bool reloadOnUpdate = !hasSaved || settings_.getBoolean("loader.update.hmr", false);

    host_->runInBackground([this, savedPath, hasSaved, waitForDownload, token, reloadOnUpdate]() {
        std::string downloaded;
        try
        {
            downloaded = updater_.downloadBundle(savedPath, host_->resolveUpdateURL(),
                                                 host_->runtimeBytecodeVersion());
            settings_.setString(kCheckedLoaderSetting, loaderVersion());
        }
        catch (const std::exception &error)
        {
            const auto         *update  = dynamic_cast<const BundleUpdateError *>(&error);
            BundleUpdateFailure failure = update ? update->failure : BundleUpdateFailure::Network;
            // Even a failed check counts, so an offline launch does not wait again next time.
            settings_.setString(kCheckedLoaderSetting, loaderVersion());
            log(hasSaved ? LogLevel::Warning : LogLevel::Error, LOG_CATEGORY_DEFAULT,
                std::string("Bundle download failed. (") + error.what() + ")" +
                    (hasSaved ? "; using the cached bundle" : ""));
            if (waitForDownload)
            {
                settleFirstDownload(token, std::nullopt);
            }
            if (!hasSaved && token == token_.load())
            {
                host_->alert(bundleFailureNotice(failure));
            }
            return;
        }

        bool updated = downloaded != savedPath && fileExists(downloaded);
        if (waitForDownload &&
            settleFirstDownload(token,
                                updated ? std::optional<std::string>(downloaded) : std::nullopt))
        {
            return;
        }
        if (updated && !reloadOnUpdate && token == token_.load())
        {
            // The client offers a restart; otherwise it runs at the next launch.
            bundleStaged_.store(true);
        }
        if (!updated || !reloadOnUpdate || token != token_.load())
        {
            return;
        }

        // A bundle that failed to evaluate would download, reload and fail again.
        if (evaluationFailed_.load())
        {
            log(LogLevel::Warning, LOG_CATEGORY_DEFAULT,
                "Downloaded a bundle; it runs at the next launch, since the last one failed.");
            return;
        }

        log(LogLevel::Info, LOG_CATEGORY_DEFAULT,
            "Downloaded a new bundle; reloading to run it before Discord's bundle.");
        host_->reload();
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
        recordCrashSummary(crashDisabledNotice(addon));
        host_->crashAlert(crashDisabledNotice(addon));
    }
}

void LoaderPipeline::injectPreBundle(jsi::Runtime &runtime, const std::string &bundlePath)
{
    host_->installNativeModules(runtime);
    installConsoleCapture(runtime);
    announceCrashDisabledAddons();

    // Before the bundle and Discord's, so the backend installs React's DevTools hook before React
    // loads.
    if (settings_.getBoolean("loader.devtools", false))
    {
        if (std::optional<std::string> devtools =
                updater_.devtoolsScript(bundlePath, host_->runtimeBytecodeVersion()))
        {
            log(LogLevel::Info, LOG_CATEGORY_DEFAULT, "Executing DevTools bundle...");
            evaluateScript(runtime, std::move(*devtools), "unbound:devtools");
        }
    }

    try
    {
        UnboundNativeProvider provider = host_->unboundNativeProvider();
        provider.hasStagedBundle       = [this]() {
            return nlohmann::json(hasStagedBundle());
        };
        installUnboundNative(runtime, std::move(provider));
    }
    catch (const std::exception &error)
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT,
            std::string("Failed to install UnboundNative: ") + error.what());
    }
}

void LoaderPipeline::onRuntimeCreated(jsi::Runtime &runtime)
{
    std::optional<SavedBundle> saved = takeSavedBundle();
    if (!saved)
    {
        log(LogLevel::Info, LOG_CATEGORY_DEFAULT,
            "No saved bundle to run before Discord's bundle; Unbound runs once it downloads.");
        return;
    }

    evaluate(runtime, std::move(*saved), token_.load());
}

// Resolves the bundle this launch runs: the saved one, or the download it waited for.
std::optional<LoaderPipeline::SavedBundle> LoaderPipeline::takeSavedBundle()
{
    std::optional<SavedBundle> saved;
    {
        std::lock_guard<std::mutex> lock(savedMutex_);
        saved.swap(saved_);
    }

    return saved ? saved : awaitFirstDownload(token_.load());
}

bool LoaderPipeline::settleFirstDownload(uint64_t token, std::optional<std::string> path)
{
    std::lock_guard<std::mutex> lock(savedMutex_);
    if (firstDownload_.token != token)
    {
        return false;
    }
    firstDownload_.settled = true;
    firstDownload_.path    = std::move(path);
    firstDownloadSettled_.notify_all();
    return !firstDownload_.abandoned;
}

std::optional<LoaderPipeline::SavedBundle> LoaderPipeline::awaitFirstDownload(uint64_t token)
{
    std::unique_lock<std::mutex> lock(savedMutex_);
    if (firstDownload_.token != token || !firstDownload_.pending)
    {
        return std::nullopt;
    }
    bool waiting = !firstDownload_.settled;
    if (waiting)
    {
        host_->showUpdateProgress(true);
    }
    bool settled = firstDownloadSettled_.wait_for(lock, kFirstDownloadWait, [this, token]() {
        return firstDownload_.token != token || firstDownload_.settled;
    });
    if (waiting)
    {
        host_->showUpdateProgress(false);
    }
    if (firstDownload_.token != token)
    {
        return std::nullopt;
    }
    std::optional<SavedBundle> fallback = std::move(firstDownload_.fallback);
    if (!settled)
    {
        firstDownload_.abandoned = true;
        return fallback;
    }
    if (!firstDownload_.path)
    {
        return fallback;
    }

    std::optional<SavedBundle> bundle = readSavedBundle(*firstDownload_.path);
    if (!bundle || bundle->empty())
    {
        firstDownload_.abandoned = true;
        return fallback;
    }
    log(LogLevel::Info, LOG_CATEGORY_DEFAULT,
        "Downloaded Unbound's first bundle in time to run it before Discord's.");
    return bundle;
}

bool LoaderPipeline::evaluate(jsi::Runtime &runtime, SavedBundle saved, uint64_t token)
{
    jsi::Object global = runtime.global();

    if (!updater_.markBundleAttempted(saved.path))
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT, "Bundle validation marker could not be saved.");
        return false;
    }

    global.setProperty(runtime, "__loaderBundleInstalled", jsi::Value(true));
    injectPreBundle(runtime, saved.path);

    log(LogLevel::Info, LOG_CATEGORY_DEFAULT, "Evaluating Unbound's bundle before Discord's...");
    bool evaluated = saved.bytecode ? evaluateBytecodeBuffer(runtime, saved.bytecode, "unbound")
                                    : evaluateScript(runtime, std::move(saved.bundle), "unbound");
    if (!evaluated)
    {
        global.setProperty(runtime, "__loaderBundleInstalled", jsi::Value(false));
        evaluationFailed_.store(true);
        updater_.rejectBundle(saved.path);
        return false;
    }

    // A candidate replaces the active bundle only once Discord has run healthily with it; if
    // Discord dies first, its attempt marker makes the next launch discard it.
    {
        std::lock_guard<std::mutex> lock(promotionMutex_);
        pendingPromotion_ = saved.path;
    }
    host_->runAfter(kHealthySeconds, [this]() {
        promotePendingBundle();
    });
    log(LogLevel::Info, LOG_CATEGORY_DEFAULT, "Unbound's bundle was successfully executed.");
    if (token == token_.load())
    {
        bundleReady_.store(true);
        host_->onBundleExecuted();
    }
    return true;
}

void LoaderPipeline::promotePendingBundle()
{
    std::optional<std::string> path;
    {
        std::lock_guard<std::mutex> lock(promotionMutex_);
        path.swap(pendingPromotion_);
    }
    if (path && !updater_.acceptBundle(*path))
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT, "Validated bundle could not be promoted.");
    }
}

// Once per process: counts launches that ended early and steps in after repeated ones.
void LoaderPipeline::guardLaunch()
{
    if (launchGuarded_.exchange(true))
    {
        return;
    }

    LaunchGuard   guard(updater_.documents());
    LaunchVerdict verdict = guard.begin();
    if (verdict.rollBack && updater_.rollBackToPrevious())
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT, launchRollBackNotice(verdict.failures));
        recordCrashSummary(launchRollBackNotice(verdict.failures));
        host_->crashAlert(launchRollBackNotice(verdict.failures));
    }
    if (verdict.enterRecovery && settings_.setBoolean)
    {
        settings_.setBoolean("recovery", true);
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT, launchRecoveryNotice(verdict.failures));
        recordCrashSummary(launchRecoveryNotice(verdict.failures));
        host_->crashAlert(launchRecoveryNotice(verdict.failures));
    }
    host_->runAfter(kHealthySeconds, [this]() {
        markHealthy();
    });
}

void LoaderPipeline::markHealthy()
{
    promotePendingBundle();
    if (!launchGuarded_.load() || launchHealthy_.exchange(true))
    {
        return;
    }
    LaunchGuard(updater_.documents()).succeed();
    log(LogLevel::Info, LOG_CATEGORY_DEFAULT, "Discord ran long enough to count as healthy.");
}
}
