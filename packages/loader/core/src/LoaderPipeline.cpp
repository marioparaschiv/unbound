#include "LoaderPipeline.h"

#include <iterator>
#include <random>

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
#include "LoaderPreferences.h"
#include "LoaderVersion.h"

namespace loader {
namespace jsi = facebook::jsi;

static constexpr std::chrono::seconds kFirstDownloadWait{10};

static std::atomic<LoaderPipeline *> currentPipeline{nullptr};

static int64_t nowMs()
{
    return std::chrono::duration_cast<std::chrono::milliseconds>(
               std::chrono::steady_clock::now().time_since_epoch())
        .count();
}

static double randomUnit()
{
    thread_local std::mt19937 generator{std::random_device{}()};
    return std::uniform_real_distribution<double>(0.0, 1.0)(generator);
}

LoaderPipeline::LoaderPipeline(std::shared_ptr<PipelineHost> host, SettingsStore &settings,
                               BundleUpdater &updater)
    : host_(std::move(host)), settings_(settings), updater_(updater)
{
    bootstrap::setScriptSource(
        [weak = std::weak_ptr<PipelineHost>(host_)](const std::string &name) {
            auto host = weak.lock();
            return host ? host->resource(name) : std::nullopt;
        });
    currentPipeline.store(this);
}

LoaderPipeline::~LoaderPipeline()
{
    LoaderPipeline *self = this;
    currentPipeline.compare_exchange_strong(self, nullptr);
}

std::string LoaderPipeline::currentLaunchTimings()
{
    LoaderPipeline *pipeline = currentPipeline.load();
    return pipeline ? pipeline->launchTimings() : "Unbound's loader has not started.";
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
    runtimeCreatedMs_.store(nowMs());
    bundleExecutedMs_.store(0);
    renderedMs_.store(0);
    rendered_.store(false);
    bundleReady_.store(false);
    bundleStaged_.store(false);
    uint64_t token = token_.fetch_add(1) + 1;
    {
        std::lock_guard<std::mutex> lock(savedMutex_);
        saved_.reset();
        firstDownload_ = FirstDownload{token};
    }

    if (!preferences::loaderEnabled(settings_))
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
    bool loaderChanged = hasSaved && preferences::checkedByLoader(settings_) != loaderVersion();
    // Hot reload waits for the newest bundle too: reloading once it lands would tear the runtime
    // down while Discord's bundle is still starting its native modules.
    bool hotReload       = preferences::hotReloadEnabled(settings_);
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
                                        uint64_t token, size_t attempt)
{
    bool reloadOnUpdate = !hasSaved || preferences::hotReloadEnabled(settings_);

    if (waitsForWifi(hasSaved, waitForDownload))
    {
        // Checked again when Discord returns to the foreground.
        waitingForWifi_.store(true);
        log(LogLevel::Info, LOG_CATEGORY_DEFAULT,
            "On a metered network; the update check waits for Wi-Fi.");
        return;
    }
    waitingForWifi_.store(false);
    checking_.store(true);
    lastCheckMs_.store(nowMs());

    host_->runInBackground([this, savedPath, hasSaved, waitForDownload, token, reloadOnUpdate,
                            attempt]() {
        struct CheckDone {
            std::atomic_bool &checking;
            ~CheckDone()
            {
                checking.store(false);
            }
        } done{checking_};
        std::string downloaded;
        try
        {
            downloaded = updater_.downloadBundle(savedPath, host_->resolveUpdateURL(),
                                                 host_->runtimeBytecodeVersion());
            preferences::setCheckedByLoader(settings_, loaderVersion());
        }
        catch (const std::exception &error)
        {
            const auto         *update  = dynamic_cast<const BundleUpdateError *>(&error);
            BundleUpdateFailure failure = update ? update->failure : BundleUpdateFailure::Network;
            // Even a failed check counts, so an offline launch does not wait again next time.
            preferences::setCheckedByLoader(settings_, loaderVersion());
            log(hasSaved ? LogLevel::Warning : LogLevel::Error, LOG_CATEGORY_DEFAULT,
                std::string("Bundle download failed. (") + error.what() + ")" +
                    (hasSaved ? "; using the cached bundle" : ""));
            if (waitForDownload)
            {
                settleFirstDownload(token, std::nullopt);
            }
            if (!hasSaved && attempt == 0 && token == token_.load())
            {
                host_->alert(bundleFailureNotice(failure));
            }
            if (failure == BundleUpdateFailure::Network &&
                attempt < std::size(kRetryDelaysSeconds) && token == token_.load())
            {
                double delay =
                    retryDelay(attempt, update ? update->retryAfter : std::nullopt, randomUnit());
                log(LogLevel::Info, LOG_CATEGORY_DEFAULT,
                    "Retrying the update check in " + std::to_string(static_cast<int>(delay)) +
                        " s.");
                host_->runAfter(delay, [this, token, attempt]() {
                    checkForUpdate(token, attempt + 1);
                });
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
    if (updater_.documents().empty())
    {
        return;
    }

    for (const CrashedAddon &addon : takeUnannouncedCrashDisabledAddons(updater_.documents()))
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
    if (preferences::devtoolsEnabled(settings_))
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
        provider.markRendered = [this]() {
            markRendered();
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
    bundleExecutedMs_.store(nowMs());
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
    LaunchVerdict verdict = guard.begin(host_->previousExit());
    if (verdict.rollBack && updater_.rollBackToPrevious())
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT, launchRollBackNotice(verdict.failures));
        recordCrashSummary(launchRollBackNotice(verdict.failures));
        host_->crashAlert(launchRollBackNotice(verdict.failures));
    }
    if (verdict.enterRecovery)
    {
        preferences::setRecoveryEnabled(settings_, true);
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
    healthyMs_.store(nowMs());
    LaunchGuard(updater_.documents()).succeed();
    log(LogLevel::Info, LOG_CATEGORY_DEFAULT, "Discord ran long enough to count as healthy.");
}

void LoaderPipeline::markRendered()
{
    if (rendered_.exchange(true))
    {
        return;
    }
    renderedMs_.store(nowMs());
    log(LogLevel::Info, LOG_CATEGORY_DEFAULT, "Discord's first screen rendered.");
    host_->runAfter(kRenderedHealthySeconds, [this]() {
        markHealthy();
    });
}

std::string LoaderPipeline::launchTimings() const
{
    int64_t     start = runtimeCreatedMs_.load();
    std::string text  = "Milliseconds after Discord's runtime was created:\n";
    auto        step  = [&](const char *name, int64_t at) {
        text += std::string(name) + ": " +
                (start && at ? std::to_string(at - start) + " ms" : "not yet") + "\n";
    };
    step("Unbound's bundle executed", bundleExecutedMs_.load());
    step("Discord's first screen rendered", renderedMs_.load());
    step("Launch counted as healthy", healthyMs_.load());
    return text;
}

double LoaderPipeline::retryDelay(size_t attempt, std::optional<double> retryAfter, double unit)
{
    if (retryAfter && *retryAfter >= 0)
    {
        return std::min(*retryAfter, kMaxRetryAfterSeconds);
    }
    size_t last = std::size(kRetryDelaysSeconds) - 1;
    return kRetryDelaysSeconds[std::min(attempt, last)] * (0.8 + 0.4 * unit);
}

bool LoaderPipeline::waitsForWifi(bool hasSaved, bool waitForDownload)
{
    // Only a launch that already has a bundle to run can put its update off.
    return hasSaved && !waitForDownload && preferences::updatesWaitForWifi(settings_) &&
           host_->onMeteredNetwork();
}

void LoaderPipeline::checkForUpdate(uint64_t token, size_t attempt)
{
    if (token != token_.load())
    {
        return;
    }
    std::string savedPath;
    try
    {
        savedPath = updater_.resolveBundlePath();
    }
    catch (const std::exception &error)
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT,
            std::string("Failed to resolve the saved bundle: ") + error.what());
        return;
    }
    updateInBackground(savedPath, !savedPath.empty() && fileExists(savedPath), false, token,
                       attempt);
}

void LoaderPipeline::onForeground()
{
    if (!preferences::loaderEnabled(settings_) || checking_.load())
    {
        return;
    }
    int64_t last = lastCheckMs_.load();
    bool due = last != 0 && nowMs() - last >= static_cast<int64_t>(kForegroundCheckSeconds * 1000);
    if (!due && !waitingForWifi_.load())
    {
        return;
    }
    log(LogLevel::Info, LOG_CATEGORY_DEFAULT,
        "Back in the foreground; checking for a newer bundle.");
    checkForUpdate(token_.load(), 0);
}
}
