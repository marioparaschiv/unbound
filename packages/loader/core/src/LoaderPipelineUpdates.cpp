#include <algorithm>
#include <iterator>
#include <random>

#include "LoaderFiles.h"
#include "LoaderLaunchReport.h"
#include "LoaderLog.h"
#include "LoaderPipeline.h"
#include "LoaderPipelineTime.h"
#include "LoaderPreferences.h"
#include "LoaderVersion.h"

namespace loader {
using pipeline_time::epochMs;
using pipeline_time::nowMs;

static double randomUnit()
{
    thread_local std::mt19937 generator{std::random_device{}()};
    return std::uniform_real_distribution<double>(0.0, 1.0)(generator);
}

// Holds the pipeline's check flag for one check on the calling thread, once any running check
// finishes; two at once would race on the candidate file.
namespace {
    class ExclusiveCheck
    {
    public:
        explicit ExclusiveCheck(std::atomic_bool &checking) : checking_(checking)
        {
            bool idle = false;
            while (!checking_.compare_exchange_weak(idle, true))
            {
                idle = false;
                std::this_thread::sleep_for(std::chrono::milliseconds(100));
            }
        }

        ~ExclusiveCheck()
        {
            checking_.store(false);
        }

        ExclusiveCheck(const ExclusiveCheck &)            = delete;
        ExclusiveCheck &operator=(const ExclusiveCheck &) = delete;

    private:
        std::atomic_bool &checking_;
    };
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
            recordUpdateCheck(epochMs(), downloaded != savedPath && fileExists(downloaded)
                                             ? "downloaded"
                                             : "current");
        }
        catch (const std::exception &error)
        {
            const auto         *update  = dynamic_cast<const BundleUpdateError *>(&error);
            BundleUpdateFailure failure = update ? update->failure : BundleUpdateFailure::Network;
            // Even a failed check counts, so an offline launch does not wait again next time.
            preferences::setCheckedByLoader(settings_, loaderVersion());
            recordUpdateCheck(epochMs(), "failed", error.what());
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

bool LoaderPipeline::isBundleUpdateAvailable()
{
    ExclusiveCheck check(checking_);
    log(LogLevel::Info, LOG_CATEGORY_DEFAULT, "The client asked whether a newer bundle exists.");

    return updater_.isUpdateAvailable(updater_.resolveBundlePath(), host_->resolveUpdateURL(),
                                      host_->runtimeBytecodeVersion());
}

bool LoaderPipeline::updateBundleNow()
{
    ExclusiveCheck check(checking_);
    uint64_t       token = token_.load();
    waitingForWifi_.store(false);
    lastCheckMs_.store(nowMs());
    log(LogLevel::Info, LOG_CATEGORY_DEFAULT, "The client asked to download a newer bundle.");

    std::string savedPath = updater_.resolveBundlePath();
    std::string downloaded;
    try
    {
        downloaded = updater_.downloadBundle(savedPath, host_->resolveUpdateURL(),
                                             host_->runtimeBytecodeVersion());
    }
    catch (const std::exception &error)
    {
        recordUpdateCheck(epochMs(), "failed", error.what());
        throw;
    }

    bool updated = downloaded != savedPath && fileExists(downloaded);
    recordUpdateCheck(epochMs(), updated ? "downloaded" : "current");
    if (updated && token == token_.load())
    {
        bundleStaged_.store(true);
    }
    return hasStagedBundle();
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

bool LoaderPipeline::checkIfDue(const char *reason, double intervalSeconds)
{
    if (!preferences::loaderEnabled(settings_) || checking_.load())
    {
        return false;
    }
    int64_t last = lastCheckMs_.load();
    bool    due  = last != 0 && nowMs() - last >= static_cast<int64_t>(intervalSeconds * 1000);
    if (!due && !waitingForWifi_.load())
    {
        return false;
    }
    log(LogLevel::Info, LOG_CATEGORY_DEFAULT, reason);
    checkForUpdate(token_.load(), 0);
    return true;
}

void LoaderPipeline::onForeground()
{
    checkIfDue("Back in the foreground; checking for a newer bundle.", kForegroundCheckSeconds);
}

bool LoaderPipeline::onBackground()
{
    checkIfDue("Going to the background; checking for a newer bundle while there is time.",
               kBackgroundCheckSeconds);
    return checking_.load();
}

bool LoaderPipeline::isCheckingForUpdate() const
{
    return checking_.load();
}
}
