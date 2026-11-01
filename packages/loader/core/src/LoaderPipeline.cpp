#include "LoaderPipeline.h"

#include "LoaderBootstrap.h"
#include "LoaderCrashGuard.h"
#include "LoaderFiles.h"
#include "LoaderJSI.h"
#include "LoaderLog.h"
#include "LoaderLogFile.h"
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

void LoaderPipeline::prepare()
{
    // Hosts call this once Discord's runtime exists, before addons load for it; smoke timing starts
    // here.
    log(LogLevel::Info, LOG_CATEGORY_RUNTIME, "Discord's runtime was created.");
    bundleReady_.store(false);
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
    std::optional<std::string> bundle =
        !savedPath.empty() && fileExists(savedPath) ? readTextFile(savedPath) : std::nullopt;
    bool hasSaved = bundle && !bundle->empty();
    {
        std::lock_guard<std::mutex> lock(savedMutex_);
        if (hasSaved)
        {
            saved_ = SavedBundle{std::move(*bundle), savedPath};
        }
        else
        {
            firstDownload_.pending = true;
        }
    }

    updateInBackground(savedPath, hasSaved, token);
}

// Downloads the newest bundle for the next runtime. With no saved bundle, or with
// `loader.update.hmr`, reloads once a new one arrives so it runs now, before Discord's bundle.
void LoaderPipeline::updateInBackground(std::string savedPath, bool hasSaved, uint64_t token)
{
    bool reloadOnUpdate = !hasSaved || settings_.getBoolean("loader.update.hmr", false);

    host_->runInBackground([this, savedPath, hasSaved, token, reloadOnUpdate]() {
        std::string downloaded;
        try
        {
            downloaded = updater_.downloadBundle(savedPath, host_->resolveUpdateURL(),
                                                 host_->runtimeBytecodeVersion());
        }
        catch (const std::exception &error)
        {
            log(hasSaved ? LogLevel::Warning : LogLevel::Error, LOG_CATEGORY_DEFAULT,
                std::string("Bundle download failed. (") + error.what() + ")" +
                    (hasSaved ? "; using the cached bundle" : ""));
            if (!hasSaved)
            {
                settleFirstDownload(token, std::nullopt);
            }
            if (!hasSaved && token == token_.load())
            {
                host_->alert(
                    "Failed to load Unbound's bundle. Please report this to the developers.");
            }
            return;
        }

        bool updated = downloaded != savedPath && fileExists(downloaded);
        if (!hasSaved && settleFirstDownload(token, updated ? std::optional<std::string>(downloaded)
                                                            : std::nullopt))
        {
            return;
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
            evaluateScript(runtime, *devtools, "unbound:devtools");
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
    std::optional<SavedBundle> saved;
    {
        std::lock_guard<std::mutex> lock(savedMutex_);
        saved.swap(saved_);
    }

    if (!saved)
    {
        saved = awaitFirstDownload(token_.load());
    }

    if (!saved)
    {
        log(LogLevel::Info, LOG_CATEGORY_DEFAULT,
            "No saved bundle to run before Discord's bundle; Unbound runs once it downloads.");
        return;
    }

    evaluate(runtime, *saved, token_.load());
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
    bool settled = firstDownloadSettled_.wait_for(lock, kFirstDownloadWait, [this, token]() {
        return firstDownload_.token != token || firstDownload_.settled;
    });
    if (firstDownload_.token != token)
    {
        return std::nullopt;
    }
    if (!settled)
    {
        firstDownload_.abandoned = true;
        return std::nullopt;
    }
    if (!firstDownload_.path)
    {
        return std::nullopt;
    }

    std::optional<std::string> bundle = readTextFile(*firstDownload_.path);
    if (!bundle || bundle->empty())
    {
        firstDownload_.abandoned = true;
        return std::nullopt;
    }
    log(LogLevel::Info, LOG_CATEGORY_DEFAULT,
        "Downloaded Unbound's first bundle in time to run it before Discord's.");
    return SavedBundle{std::move(*bundle), *firstDownload_.path};
}

bool LoaderPipeline::evaluate(jsi::Runtime &runtime, const SavedBundle &saved, uint64_t token)
{
    jsi::Object global = runtime.global();

    if (!updater_.markBundleAttempted(saved.path))
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT, "Bundle validation marker could not be saved.");
        return false;
    }

    global.setProperty(runtime, "__loaderBundleInstalled", jsi::Value(true));
    injectPreBundle(runtime);

    log(LogLevel::Info, LOG_CATEGORY_DEFAULT, "Evaluating Unbound's bundle before Discord's...");
    if (!evaluateScript(runtime, saved.bundle, "unbound"))
    {
        global.setProperty(runtime, "__loaderBundleInstalled", jsi::Value(false));
        evaluationFailed_.store(true);
        updater_.rejectBundle(saved.path);
        return false;
    }

    if (!updater_.acceptBundle(saved.path))
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT, "Validated bundle could not be promoted.");
    }
    log(LogLevel::Info, LOG_CATEGORY_DEFAULT, "Unbound's bundle was successfully executed.");
    if (token == token_.load())
    {
        bundleReady_.store(true);
        host_->onBundleExecuted();
    }
    return true;
}
}
