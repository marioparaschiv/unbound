#pragma once

#include <cstdint>
#include <functional>
#include <map>
#include <optional>
#include <string>

#include "LoaderBundleManifest.h"
#include "LoaderBundleSignature.h"
#include "LoaderSettings.h"

namespace loader {
struct DownloadResult {
    int         status = 0;
    std::string etag;
};

struct DownloadPolicy {
    double connectTimeoutSeconds = 15.0;
    double readTimeoutSeconds    = 30.0;
    double totalTimeoutSeconds   = 35.0;
};

constexpr DownloadPolicy kBundleDownloadPolicy{};
constexpr double         kManifestFetchTimeoutSeconds = 5.0;

bool isAcceptedDownloadStatus(int status);

using TextFetcher =
    std::function<std::optional<std::string>(const std::string &url, double timeoutSeconds)>;
using FileDownloader = std::function<std::optional<DownloadResult>(
    const std::string &url, const std::string &destination,
    const std::map<std::string, std::string> &headers, const DownloadPolicy &policy)>;

struct UpdaterSettings {
    std::function<std::string(const std::string &key, const std::string &fallback)> getString;
    std::function<bool(const std::string &key, bool fallback)>                      getBoolean;
    std::function<void(const std::string &key, const std::string &value)>           setString;
};

UpdaterSettings updaterSettings(SettingsStore &store);

#ifndef UNBOUND_DEFAULT_BUNDLE_URL
#define UNBOUND_DEFAULT_BUNDLE_URL "https://builds.unbound.rip/"
#endif

constexpr const char *kDefaultBundleBaseURL  = UNBOUND_DEFAULT_BUNDLE_URL;
constexpr const char *kBundleTrustSuffix     = ".trust";
constexpr const char *kBundleBaselineSetting = "loader.update.baseline";

class BundleUpdater
{
public:
    BundleUpdater(std::string documents, UpdaterSettings settings, TextFetcher fetchText,
                  FileDownloader download, BundleTrust trust = compiledBundleTrust());

    std::string resolveBundlePath();
    std::string downloadBundle(const std::string                &preferredPath,
                               const std::optional<std::string> &updateURL,
                               uint32_t                          bytecodeVersion);
    std::string downloadURL(const std::optional<std::string> &updateURL, uint32_t bytecodeVersion);

    bool markBundleAttempted(const std::string &path);
    bool acceptBundle(const std::string &path);
    void rejectBundle(const std::string &path);

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
        bool        bundleSignatureOnly = false;
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
    void                       recordBaseline(const std::string &record);

    std::string     documents_;
    UpdaterSettings settings_;
    TextFetcher     fetchText_;
    FileDownloader  download_;
    BundleTrust     trust_;
};
}
