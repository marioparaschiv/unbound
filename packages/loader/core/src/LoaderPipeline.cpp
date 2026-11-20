#include "LoaderPipeline.h"

#include <algorithm>
#include <iterator>
#include <random>

#include "HermesBytecodeHeader.h"
#include "HermesSampling.h"
#include "LoaderBootstrap.h"
#include "LoaderBundleRecord.h"
#include "LoaderBundleSignature.h"
#include "LoaderCrashGuard.h"
#include "LoaderCrashReport.h"
#include "LoaderFiles.h"
#include "LoaderJSI.h"
#include "LoaderLaunchGuard.h"
#include "LoaderLaunchReport.h"
#include "LoaderLog.h"
#include "LoaderLogFile.h"
#include "LoaderPipelineTime.h"
#include "LoaderPreferences.h"
#include "LoaderStrings.h"
#include "LoaderVersion.h"

namespace loader {
namespace jsi = facebook::jsi;
using pipeline_time::epochMs;
using pipeline_time::nowMs;

static constexpr std::chrono::seconds kFirstDownloadWait{10};

LoaderPipeline::LoaderPipeline(std::shared_ptr<PipelineHost> host, SettingsStore &settings,
                               BundleUpdater &updater)
    : host_(std::move(host)), settings_(settings), updater_(updater)
{
    bootstrap::setScriptSource(
        [weak = std::weak_ptr<PipelineHost>(host_)](const std::string &name) {
            auto host = weak.lock();
            return host ? host->resource(name) : std::nullopt;
        });
}

LoaderPipeline::~LoaderPipeline() = default;

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

    if (!settings_.readable())
    {
        log(LogLevel::Warning, LOG_CATEGORY_DEFAULT,
            "Discord started before the device was unlocked, so Unbound's files cannot be read; "
            "Unbound sits out this launch rather than mistake them for damage.");
        return;
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

    if (!savedPath.empty() && fileExists(savedPath))
    {
        if (std::optional<std::string> problem = updater_.integrityProblem(savedPath))
        {
            log(LogLevel::Error, LOG_CATEGORY_DEFAULT,
                "The saved bundle is damaged (" + *problem + "); downloading a fresh copy.");
            updater_.healDamagedBundle(savedPath);
            savedPath = updater_.resolveBundlePath();
        }
    }

    if (savedPath.ends_with(kBundleCandidateSuffix))
    {
        setBundleState(BundleState::Trial);
    }

    // A local read, so the bundle can run before Discord's without waiting on the network.
    std::optional<SavedBundle> bundle =
        !savedPath.empty() && fileExists(savedPath) ? readSavedBundle(savedPath) : std::nullopt;
    if (bundle && bundle->bytecode)
    {
        uint32_t savedVersion =
            hermesBytecodeVersion(bundle->bytecode->data(), bundle->bytecode->size());
        uint32_t runtimeVersion = host_->runtimeBytecodeVersion();
        if (savedVersion != 0 && runtimeVersion != 0 && savedVersion != runtimeVersion)
        {
            log(LogLevel::Warning, LOG_CATEGORY_DEFAULT,
                "Discord now runs Hermes bytecode " + std::to_string(runtimeVersion)
                    + ", but the saved bundle was built for " + std::to_string(savedVersion)
                    + "; waiting for a matching bundle.");
            bundle.reset();
        }
    }

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
    bool devServer       = isDevelopmentBundleURL(preferences::updateURL(settings_));
    bool waitForDownload = !hasSaved || flavourSwitch || loaderChanged || hotReload || devServer;
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
        provider.checkForBundleUpdate = [this]() {
            return isBundleUpdateAvailable();
        };
        provider.updateBundle = [this]() {
            return updateBundleNow();
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
    if (firstDownload_.bannerUp)
    {
        firstDownload_.bannerUp = false;
        host_->showUpdateProgress(false);
    }

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
    if (waiting && settled)
    {
        host_->showUpdateProgress(false);
    }
    else if (waiting)
    {
        firstDownload_.bannerUp = true;
        log(LogLevel::Info, LOG_CATEGORY_DEFAULT,
            "Discord starts without Unbound while its first bundle keeps downloading; the banner "
            "stays up until it lands.");
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
        updater_.discardFailedBundle(saved.path);
        return false;
    }

    // A candidate replaces the active bundle only once Discord has run healthily with it; if
    // Discord dies first, its attempt marker makes the next launch discard it.
    {
        std::lock_guard<std::mutex> lock(promotionMutex_);
        pendingPromotion_ = saved.path;
    }

    if (isDevelopmentBundleURL(preferences::updateURL(settings_)))
    {
        promotePendingBundle();
    }
    else
    {
        host_->runAfter(kHealthySeconds, [this]() {
            promotePendingBundle();
        });
    }

    recordRunningBundle(saved.path);
    bundleExecutedMs_.store(nowMs());
    log(LogLevel::Info, LOG_CATEGORY_DEFAULT, "Unbound's bundle was successfully executed.");
    if (token == token_.load())
    {
        bundleReady_.store(true);
        host_->onBundleExecuted();
    }

    return true;
}

void LoaderPipeline::recordRunningBundle(const std::string &path)
{
    nlohmann::json record = parseBundleRecord(readTextFile(path + kBundleTrustSuffix));
    std::optional<BundleManifest> manifest =
        parseBundleManifest(bundleRecordField(record, "manifest"));
    if (manifest)
    {
        setRunningBundle(manifest->revision, manifest->channel);
    }

    std::string updateURL = preferences::updateURL(settings_);
    setBundleSource(bundleSourceOf(updateURL, isDevelopmentBundleURL(updateURL)),
                    pullRequestOf(updateURL));
}

void LoaderPipeline::promotePendingBundle()
{
    std::optional<std::string> path;
    {
        std::lock_guard<std::mutex> lock(promotionMutex_);
        path.swap(pendingPromotion_);
    }

    if (!path)
    {
        return;
    }

    if (!updater_.acceptBundle(*path))
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT, "Validated bundle could not be promoted.");
        return;
    }

    if (path->ends_with(kBundleCandidateSuffix))
    {
        setBundleState(BundleState::Active);
        log(LogLevel::Info, LOG_CATEGORY_DEFAULT,
            "Promoted the new bundle; it is now the active one.");
    }
}

// Once per process: counts launches that ended early and steps in after repeated ones.
void LoaderPipeline::guardLaunch()
{
    if (launchGuarded_.exchange(true))
    {
        return;
    }

    LaunchGuard guard(updater_.documents());
    PreviousExit previous = host_->previousExit();
    LaunchVerdict verdict = guard.begin(previous);
    if (host_->tracksVisibility() && host_->visibleNow())
    {
        noteVisible();
    }
    else if (host_->tracksVisibility() && visibleMs_.load() == 0)
    {
        guard.markHidden();
        if (visibleMs_.load() != 0)
        {
            guard.markShown();
        }
    }

    if (verdict.rollBack && updater_.rollBackToPrevious())
    {
        setBundleState(BundleState::RolledBack);
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT, launchRollBackNotice(verdict.failures));
        recordCrashSummary(launchRollBackNotice(verdict.failures));
        host_->crashAlert(launchRollBackNotice(verdict.failures));
    }

    if (verdict.enterRecovery)
    {
        preferences::setRecoveryEnabled(settings_, true);
        preferences::setAutomaticRecoveryKey(settings_, recoveryKey());
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT, launchRecoveryNotice(verdict.failures));
        recordCrashSummary(launchRecoveryNotice(verdict.failures));
        host_->crashAlert(launchRecoveryNotice(verdict.failures));
    }

    recordLaunchVerdict(verdict.failures, preferences::recoveryEnabled(settings_), previous);
    host_->runAfter(kHealthySeconds, [this]() {
        markHealthy();
    });
    host_->runAfter(kStuckLaunchSeconds, [this]() {
        offerHelpIfStuck();
    });
}

bool LoaderPipeline::awaitingVisibility() const
{
    return host_->tracksVisibility() && visibleMs_.load() == 0;
}

void LoaderPipeline::noteVisible()
{
    int64_t expected = 0;
    if (!visibleMs_.compare_exchange_strong(expected, nowMs()))
    {
        return;
    }

    if (launchGuarded_.load())
    {
        LaunchGuard(updater_.documents()).markShown();
    }

    host_->runAfter(kHealthySeconds, [this]() {
        markHealthy();
    });
    host_->runAfter(kStuckLaunchSeconds, [this]() {
        offerHelpIfStuck();
    });
}

bool LoaderPipeline::startedWithoutUnbound()
{
    std::lock_guard<std::mutex> lock(savedMutex_);
    return firstDownload_.abandoned && bundleExecutedMs_.load() == 0;
}

void LoaderPipeline::offerHelpIfStuck()
{
    if (awaitingVisibility())
    {
        return;
    }

    if (startedWithoutUnbound())
    {
        log(LogLevel::Info, LOG_CATEGORY_DEFAULT,
            "Skipped the stuck-launch notice: Discord started without Unbound while its first "
            "bundle downloads.");
        return;
    }

    if (rendered_.load() || stuckOffered_.exchange(true))
    {
        return;
    }

    log(LogLevel::Warning, LOG_CATEGORY_DEFAULT, kStuckLaunchNotice);
    host_->stuckLaunch(text("UNBOUND_NATIVE_STUCK_LAUNCH", kStuckLaunchNotice));
}

void LoaderPipeline::markHealthy()
{
    if (awaitingVisibility())
    {
        return;
    }

    int64_t created = std::max(runtimeCreatedMs_.load(), visibleMs_.load());
    if (bundleExecutedMs_.load() != 0 && !rendered_.load() && created != 0
        && nowMs() - created >= static_cast<int64_t>((kHealthySeconds - 1) * 1000))
    {
        if (!launchHealthy_.load() && !frozen_.exchange(true))
        {
            log(LogLevel::Warning, LOG_CATEGORY_DEFAULT,
                "Discord has not rendered its first screen after "
                    + std::to_string(static_cast<int>(kHealthySeconds))
                    + " seconds; this launch counts as frozen until it does.");
            LaunchGuard(updater_.documents()).markFrozen();
        }

        return;
    }

    promotePendingBundle();
    if (!launchGuarded_.load() || launchHealthy_.exchange(true))
    {
        return;
    }

    healthyMs_.store(nowMs());
    LaunchGuard(updater_.documents()).succeed();
    leaveAutomaticRecoveryIfChanged();
    log(LogLevel::Info, LOG_CATEGORY_DEFAULT, "Discord ran long enough to count as healthy.");
}

std::string LoaderPipeline::recoveryKey() const
{
    std::optional<BundleBaseline> baseline = parseBaseline(preferences::bundleBaseline(settings_));
    return std::string(loaderVersion()) + "|" + (baseline ? baseline->revision : "");
}

void LoaderPipeline::leaveAutomaticRecoveryIfChanged()
{
    std::string enteredWith = preferences::automaticRecoveryKey(settings_);
    if (!preferences::recoveryEnabled(settings_) || enteredWith.empty()
        || enteredWith == recoveryKey())
    {
        return;
    }

    preferences::setRecoveryEnabled(settings_, false);
    log(LogLevel::Info, LOG_CATEGORY_DEFAULT,
        "Left Recovery Mode for the next launch: the loader or bundle changed since it turned on "
        "automatically. It turns on again if Discord keeps closing during startup.");
}

void LoaderPipeline::markRendered()
{
    if (rendered_.exchange(true))
    {
        return;
    }

    int64_t rendered = nowMs();
    renderedMs_.store(rendered);
    if (int64_t created = runtimeCreatedMs_.load(); created != 0)
    {
        int64_t executed = bundleExecutedMs_.load();
        recordLaunchTiming(executed ? executed - created : 0, rendered - created);
    }

    log(LogLevel::Info, LOG_CATEGORY_DEFAULT, "Discord's first screen rendered.");
    host_->runAfter(kRenderedHealthySeconds, [this]() {
        markHealthy();
    });
}
}
