#pragma once

#include <cstdint>
#include <functional>
#include <map>
#include <optional>
#include <stdexcept>
#include <string>

#include "LoaderBundleManifest.h"
#include "LoaderBundleSignature.h"
#include "LoaderSettings.h"

namespace loader {
struct DownloadResult {
    int         status = 0;
    std::string etag;
    // The response's Retry-After header, if any.
    std::string retryAfter;
};

struct DownloadPolicy {
    double connectTimeoutSeconds = 15.0;
    double readTimeoutSeconds    = 30.0;
    double totalTimeoutSeconds   = 35.0;
};

constexpr DownloadPolicy kBundleDownloadPolicy{};
constexpr double         kManifestFetchTimeoutSeconds = 5.0;

bool isAcceptedDownloadStatus(int status);
// Seconds a Retry-After header asks to wait; HTTP dates and nonsense give nothing.
std::optional<double> retryAfterSeconds(const std::string &header);

// Why a bundle update failed, so a launch without a saved bundle can say what to do about it.
enum class BundleUpdateFailure
{
    Network,
    Verification,
    LoaderTooOld,
    Storage,
};

class BundleUpdateError : public std::runtime_error
{
public:
    BundleUpdateError(BundleUpdateFailure failure, const std::string &message,
                      std::optional<double> retryAfter = std::nullopt)
        : std::runtime_error(message), failure(failure), retryAfter(retryAfter)
    {
    }

    BundleUpdateFailure   failure;
    std::optional<double> retryAfter;
};

// The alert for a launch that has no saved bundle and could not download one.
std::string bundleFailureNotice(BundleUpdateFailure failure);

using TextFetcher =
    std::function<std::optional<std::string>(const std::string &url, double timeoutSeconds)>;
using FileDownloader = std::function<std::optional<DownloadResult>(
    const std::string &url, const std::string &destination,
    const std::map<std::string, std::string> &headers, const DownloadPolicy &policy)>;

struct UpdaterSettings {
    std::function<std::string(const std::string &key, const std::string &fallback)> getString;
    std::function<bool(const std::string &key, bool fallback)>                      getBoolean;
    std::function<void(const std::string &key, const std::string &value)>           setString;
    std::function<void(const std::string &key, bool value)>                         setBoolean;
    std::function<bool()>                                                           developerMode;
};

UpdaterSettings updaterSettings(SettingsStore &store);

constexpr const char *kBundleTrustSuffix     = ".trust";
constexpr const char *kBundleBaselineSetting = "loader.update.baseline";
// The Updates screen's switch for automatic client updates; off keeps the cached client bundle
// instead of checking for one. Absent means on.
constexpr const char *kAutoClientSetting = "updater.auto.client";
// The loader version that last checked for a bundle, so a loader update is noticed once.
constexpr const char *kCheckedLoaderSetting = "loader.update.checkedBy";
// Whether background update checks on a metered network wait for Wi-Fi.
constexpr const char *kWaitForWifiSetting = "loader.update.waitForWifi";

class BundleUpdater
{
public:
    BundleUpdater(std::string documents, UpdaterSettings settings, TextFetcher fetchText,
                  FileDownloader download, BundleTrust trust = compiledBundleTrust());

    std::string resolveBundlePath();
    // `ignorePause` is for an explicit manual refetch, which checks even while client updates
    // are paused; launch-time updates leave it false.
    std::string downloadBundle(const std::string                &preferredPath,
                               const std::optional<std::string> &updateURL,
                               uint32_t bytecodeVersion, bool ignorePause = false);
    std::string downloadURL(const std::optional<std::string> &updateURL, uint32_t bytecodeVersion);

    // The DevTools backend the bundle at `bundlePath` was built with, verified against that
    // bundle's manifest and cached beside it; downloads it on first use.
    std::optional<std::string> devtoolsScript(const std::string &bundlePath,
                                              uint32_t           bytecodeVersion);

    bool markBundleAttempted(const std::string &path);
    bool acceptBundle(const std::string &path);
    void rejectBundle(const std::string &path);
    // Puts back the bundle the last promotion replaced; false when there is none to put back.
    bool rollBackToPrevious();

    const std::string &documents() const;

    bool                developerMode() const;
    std::optional<bool> recordedDeveloperMode(const std::string &path) const;

    std::optional<BundleBaseline> baseline() const;

private:
    struct BundleSource {
        std::string                baseURL;
        std::optional<std::string> directURL;
    };

    struct DownloadPlan {
        std::string url;
        std::string source;
        std::string exemption;
        std::string manifestText;
        std::string manifestSignature;
        std::string expectedSha512;
        bool        unchanged = false;
    };

    std::string                bundlePath(const std::string &extension) const;
    BundleSource               bundleSource(const std::optional<std::string> &updateURL) const;
    std::optional<std::string> fetch(const std::string &url) const;
    std::string selectURL(const BundleSource &source, const std::optional<BundleManifest> &manifest,
                          uint32_t bytecodeVersion) const;
    std::optional<std::string> exemptionFor(const std::string &url) const;
    bool         isExemptionCurrent(const std::string &reason, const std::string &url) const;
    DownloadPlan planDownload(const std::optional<std::string> &updateURL,
                              uint32_t                          bytecodeVersion);
    std::optional<std::string> verifiedRecord(const DownloadPlan &plan,
                                              const std::string  &candidatePath) const;
    std::optional<std::string> candidateProblem(const std::string &candidatePath) const;
    bool isActiveManifest(const std::string &url, const std::string &manifestText) const;
    std::optional<std::string> pauseProblem(const std::string                &path,
                                            const std::optional<std::string> &updateURL,
                                            uint32_t bytecodeVersion) const;
    void                       recordBaseline(const std::string &record);

    std::string     documents_;
    UpdaterSettings settings_;
    TextFetcher     fetchText_;
    FileDownloader  download_;
    BundleTrust     trust_;
};
}
