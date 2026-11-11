#include "HermesBytecodeHeader.h"
#include "LoaderBundleRecord.h"
#include "LoaderFiles.h"
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
}
