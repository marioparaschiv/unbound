#include "HermesBytecodeHeader.h"
#include "LoaderBundleRecord.h"
#include "LoaderFiles.h"
#include "LoaderLog.h"
#include "LoaderPreferences.h"
#include "LoaderUpdater.h"
#include "LoaderVersion.h"
#include "NativePluginVersion.h"

namespace loader {

// Why paused client updates cannot keep the bundle at `path`: an override that needs a fresh
// bundle, or a bundle this loader and runtime cannot run as it is.
std::optional<std::string> BundleUpdater::pauseProblem(const std::string                &path,
                                                       const std::optional<std::string> &updateURL,
                                                       uint32_t bytecodeVersion) const
{
    if (preferences::forceUpdate(settings_))
    {
        return std::string("loader.update.force is on");
    }
    if (updateURL)
    {
        return "the bundle comes from " + *updateURL;
    }
    if (preferences::hotReloadEnabled(settings_))
    {
        return std::string("loader.update.hmr is on");
    }
    if (!fileExists(path) || fileSize(path) == 0)
    {
        return std::string("there is no cached bundle");
    }
    if (std::optional<std::string> problem = candidateProblem(path))
    {
        return "the cached bundle cannot be kept, as " + *problem;
    }
    std::optional<bool> downloadedFor = recordedDeveloperMode(path);
    if (downloadedFor && *downloadedFor != developerMode())
    {
        return std::string("developer mode changed since the cached bundle was downloaded");
    }
    uint32_t cachedBytecode = hermesBytecodeVersionOfFile(path);
    if (bytecodeVersion != 0 && cachedBytecode != 0 && cachedBytecode != bytecodeVersion)
    {
        return "the cached bundle targets bytecode version " + std::to_string(cachedBytecode);
    }

    std::optional<BundleManifest> manifest = parseBundleManifest(
        bundleRecordField(parseBundleRecord(readTextFile(path + kBundleTrustSuffix)), "manifest"));
    if (!manifest)
    {
        return std::nullopt;
    }
    if (std::optional<std::string> outdated = loaderVersionProblem(*manifest, loaderVersion()))
    {
        return "the cached bundle cannot run here, as " + *outdated;
    }
    return nativeBridgeProblem(*manifest, kNativePluginApiVersion, kNativePluginAbiVersion);
}

std::optional<std::string> BundleUpdater::pausedBundle(const std::string &preferredPath,
                                                       const std::optional<std::string> &updateURL,
                                                       uint32_t bytecodeVersion)
{
    if (preferences::autoClientUpdates(settings_))
    {
        return std::nullopt;
    }
    std::string cachedPath = preferredPath.empty() ? resolveBundlePath() : preferredPath;
    std::optional<std::string> problem = pauseProblem(cachedPath, updateURL, bytecodeVersion);
    if (problem)
    {
        log(LogLevel::Info, LOG_CATEGORY_UPDATER,
            "Automatic client updates are off, but " + *problem + "; checking for a bundle.");
        return std::nullopt;
    }
    log(LogLevel::Info, LOG_CATEGORY_UPDATER,
        "Automatic client updates are off; keeping the cached bundle.");
    return cachedPath;
}

bool BundleUpdater::isUpdateAvailable(const std::string                &preferredPath,
                                      const std::optional<std::string> &updateURL,
                                      uint32_t                          bytecodeVersion)
{
    if (preferredPath.ends_with(kBundleCandidateSuffix) && fileExists(preferredPath))
    {
        return false;
    }
    if (pausedBundle(preferredPath, updateURL, bytecodeVersion))
    {
        return false;
    }
    // An unsigned source, such as the dev server, has no manifest to compare; only a download
    // tells, so the check reports none rather than an update that may turn out unchanged.
    DownloadPlan plan = planDownload(updateURL, bytecodeVersion);
    if (!plan.exemption.empty() || plan.unchanged)
    {
        return false;
    }
    verifyPlan(plan);
    return true;
}
}
