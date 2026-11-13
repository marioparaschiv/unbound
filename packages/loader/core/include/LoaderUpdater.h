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
#include "LoaderTransport.h"

namespace loader {
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

constexpr const char *kBundleTrustSuffix = ".trust";
// A downloaded bundle waiting to be promoted is `unbound.<extension>.candidate`.
inline const std::string kBundleCandidateSuffix = ".candidate";
// The bundle's file extensions, in the order a launch looks for them.
constexpr const char *kBundleExtensions[] = {"bundle", "js"};

class BundleUpdater
{
public:
    BundleUpdater(std::string documents, SettingsStore &settings, TextFetcher fetchText,
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

    std::optional<std::string> integrityProblem(const std::string &path);
    void                       healDamagedBundle(const std::string &path);

    bool markBundleAttempted(const std::string &path);
    bool acceptBundle(const std::string &path);
    void rejectBundle(const std::string &path);
    void discardFailedBundle(const std::string &path);
    // Puts back the bundle the last promotion replaced; false when there is none to put back.
    bool                       rollBackToPrevious();
    std::optional<std::string> previousBundleRevision() const;

    const std::string &documents() const;

    bool                developerMode() const;
    std::optional<bool> recordedDeveloperMode(const std::string &path) const;

    std::optional<BundleBaseline> baseline() const;

private:
    struct BundleSource {
        std::string                baseURL;
        std::optional<std::string> directURL;
    };

    static constexpr uintmax_t kMinimumFreeBytes = 50ull * 1024 * 1024;

    std::optional<std::string> spaceProblem() const;

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

    std::string    documents_;
    SettingsStore &settings_;
    TextFetcher    fetchText_;
    FileDownloader download_;
    BundleTrust    trust_;
};
}
