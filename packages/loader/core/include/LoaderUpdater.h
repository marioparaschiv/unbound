#pragma once

#include <cstdint>
#include <functional>
#include <map>
#include <optional>
#include <string>

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

constexpr const char *kDefaultBundleBaseURL = UNBOUND_DEFAULT_BUNDLE_URL;

class BundleUpdater
{
public:
    BundleUpdater(std::string documents, UpdaterSettings settings, TextFetcher fetchText,
                  FileDownloader download, std::string signingKey = compiledBundleSigningKey());

    std::string resolveBundlePath();
    std::string downloadBundle(const std::string                &preferredPath,
                               const std::optional<std::string> &updateURL,
                               uint32_t                          bytecodeVersion);
    std::string downloadURL(const std::optional<std::string> &updateURL, uint32_t bytecodeVersion);

    bool markBundleAttempted(const std::string &path);
    bool acceptBundle(const std::string &path);
    void rejectBundle(const std::string &path);

private:
    std::string bundlePath(const std::string &extension) const;
    bool        isSignatureValid(const std::string &url, const std::string &candidatePath);

    std::string     documents_;
    UpdaterSettings settings_;
    TextFetcher     fetchText_;
    FileDownloader  download_;
    std::string     signingKey_;
};
}
