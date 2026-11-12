#include "LoaderUpdater.h"

#include <algorithm>
#include <cctype>
#include <filesystem>
#include <stdexcept>

#include "LoaderBundleRecord.h"
#include "LoaderDigestCache.h"
#include "LoaderFiles.h"
#include "LoaderLog.h"
#include "LoaderPreferences.h"
#include "LoaderRequiredLoader.h"
#include "LoaderVersion.h"
#include "NativePluginVersion.h"

#ifndef UNBOUND_DEFAULT_BUNDLE_URL
#define UNBOUND_DEFAULT_BUNDLE_URL "https://builds.unbound.rip/"
#endif

namespace loader {

constexpr const char *kDefaultBundleBaseURL = UNBOUND_DEFAULT_BUNDLE_URL;

static std::string lowercase(std::string value)
{
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char character) {
        return std::tolower(character);
    });
    return value;
}

static std::string urlPathExtension(const std::string &url)
{
    std::string path  = url.substr(0, url.find_first_of("?#"));
    size_t      slash = path.find_last_of('/');
    size_t      dot   = path.find_last_of('.');
    if (dot == std::string::npos || (slash != std::string::npos && dot < slash))
    {
        return "";
    }
    return lowercase(path.substr(dot + 1));
}

static std::string pathExtension(const std::string &path)
{
    size_t slash = path.find_last_of('/');
    size_t dot   = path.find_last_of('.');
    if (dot == std::string::npos || (slash != std::string::npos && dot < slash))
    {
        return "";
    }
    return lowercase(path.substr(dot + 1));
}

static std::string directoryOfURL(const std::string &url)
{
    std::string path  = url.substr(0, url.find_first_of("?#"));
    size_t      slash = path.find_last_of('/');
    if (slash == std::string::npos)
    {
        return path;
    }
    return path.substr(0, slash + 1);
}

static bool isSupportedExtension(const std::string &extension)
{
    return extension == "bundle" || extension == "js";
}

BundleUpdater::BundleUpdater(std::string documents, SettingsStore &settings, TextFetcher fetchText,
                             FileDownloader download, BundleTrust trust)
    : documents_(std::move(documents)), settings_(settings), fetchText_(std::move(fetchText)),
      download_(std::move(download)), trust_(std::move(trust))
{
}

static std::string urlFileName(const std::string &url)
{
    std::string path  = url.substr(0, url.find_first_of("?#"));
    size_t      slash = path.find_last_of('/');
    return slash == std::string::npos ? path : path.substr(slash + 1);
}

std::optional<std::string> BundleUpdater::fetch(const std::string &url) const
{
    return fetchText_ ? fetchText_(url, kManifestFetchTimeoutSeconds) : std::nullopt;
}

std::optional<BundleBaseline> BundleUpdater::baseline() const
{
    return parseBaseline(preferences::bundleBaseline(settings_));
}

bool BundleUpdater::developerMode() const
{
    return preferences::developerMode(settings_);
}

// The developer mode a bundle was downloaded for; a manifest without the dev files leaves the
// default bundle in place for developer mode, which must not count as a pending switch.
std::optional<bool> BundleUpdater::recordedDeveloperMode(const std::string &path) const
{
    std::string mode = bundleRecordField(parseBundleRecord(readTextFile(path + kBundleTrustSuffix)),
                                         "developerMode");
    return mode.empty() ? std::nullopt : std::optional<bool>(mode == "1");
}

std::optional<std::string> BundleUpdater::exemptionFor(const std::string &url) const
{
    if (!trust_.isEnabled())
    {
        log(LogLevel::Info, LOG_CATEGORY_UPDATER,
            "Bundle signature check skipped: this loader was built without a signing key.");
        return "unkeyed";
    }

    if (preferences::unsignedBundlesAllowed(settings_))
    {
        log(LogLevel::Info, LOG_CATEGORY_UPDATER,
            "Bundle signature check skipped: loader.update.unsigned is on.");
        return "unsigned";
    }

    if (isDevelopmentBundleURL(url))
    {
        log(LogLevel::Info, LOG_CATEGORY_UPDATER,
            "Bundle signature check skipped for the dev server at " + url + ".");
        return "development";
    }

    return std::nullopt;
}

std::string BundleUpdater::bundlePath(const std::string &extension) const
{
    return joinPath(documents_, "unbound." + extension);
}

BundleUpdater::BundleSource
BundleUpdater::bundleSource(const std::optional<std::string> &updateURL) const
{
    BundleSource source{updateURL.value_or(kDefaultBundleBaseURL), std::nullopt};

    if (source.baseURL.ends_with(".bundle") || source.baseURL.ends_with(".js"))
    {
        source.directURL = source.baseURL;
        source.baseURL   = directoryOfURL(source.baseURL);
    }

    if (!source.baseURL.ends_with("/"))
    {
        source.baseURL += "/";
    }
    return source;
}

std::string BundleUpdater::selectURL(const BundleSource                  &source,
                                     const std::optional<BundleManifest> &manifest,
                                     uint32_t                             bytecodeVersion) const
{
    if (!manifest)
    {
        std::string fallback = source.directURL.value_or(source.baseURL + "unbound.js");
        log(LogLevel::Warning, LOG_CATEGORY_UPDATER,
            "No usable manifest at " + source.baseURL + kBundleManifestName + "; falling back to " +
                fallback);
        return fallback;
    }

    std::string versions;
    for (uint32_t version : manifest->bytecodeVersions)
    {
        versions += (versions.empty() ? "" : ",") + std::to_string(version);
    }
    log(LogLevel::Info, LOG_CATEGORY_UPDATER,
        "Manifest bytecode versions: [" + versions +
            "], Current bytecode version: " + std::to_string(bytecodeVersion));

    std::string file = manifest->bundleFile(bytecodeVersion, developerMode());
    log(LogLevel::Info, LOG_CATEGORY_UPDATER,
        file.ends_with(".js") ? "Using JavaScript bundle" : "Using hermes bytecode bundle");
    return source.baseURL + file;
}

std::string BundleUpdater::downloadURL(const std::optional<std::string> &updateURL,
                                       uint32_t                          bytecodeVersion)
{
    BundleSource               source       = bundleSource(updateURL);
    std::optional<std::string> manifestText = fetch(source.baseURL + kBundleManifestName);
    return selectURL(source, manifestText ? parseBundleManifest(*manifestText) : std::nullopt,
                     bytecodeVersion);
}

BundleUpdater::DownloadPlan BundleUpdater::planDownload(const std::optional<std::string> &updateURL,
                                                        uint32_t bytecodeVersion)
{
    BundleSource                  source       = bundleSource(updateURL);
    std::string                   manifestURL  = source.baseURL + kBundleManifestName;
    std::optional<std::string>    manifestText = fetch(manifestURL);
    std::optional<BundleManifest> manifest =
        manifestText ? parseBundleManifest(*manifestText) : std::nullopt;

    DownloadPlan plan;
    plan.url    = selectURL(source, manifest, bytecodeVersion);
    plan.source = source.baseURL;

    if (std::optional<std::string> exemption = exemptionFor(plan.url))
    {
        plan.exemption = *exemption;
        return plan;
    }

    if (manifest && !manifest->revision.empty() && !preferences::forceUpdate(settings_) &&
        manifest->revision == preferences::rejectedRevision(settings_))
    {
        log(LogLevel::Info, LOG_CATEGORY_UPDATER,
            "Skipped build " + manifest->revision +
                ", which failed on this device; waiting for a newer one.");
        plan.unchanged = true;
        return plan;
    }

    // The active bundle came from this exact manifest: nothing changed, so the signature and
    // the bundle request can both be skipped.
    if (manifestText && isActiveManifest(plan.url, *manifestText))
    {
        plan.unchanged = true;
        return plan;
    }

    std::optional<std::string> signature =
        manifest ? fetch(manifestURL + kBundleSignatureSuffix) : std::nullopt;
    if (!manifestText)
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER, "Could not fetch " + manifestURL + ".");
        throw BundleUpdateError(BundleUpdateFailure::Network, "Could not fetch " + manifestURL);
    }
    TrustedSigner signer =
        signature ? verifyTrustedSignature(*manifestText, *signature, trust_) : TrustedSigner::None;
    std::optional<BundleBaseline> active = baseline();

    if (signer == TrustedSigner::None)
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            "Refused the update: " + manifestURL + " has no valid signature.");
        throw BundleUpdateError(BundleUpdateFailure::Verification,
                                "Bundle manifest failed signature verification");
    }

    if (!manifest->isSignable())
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            "Refused the update: the signed manifest lacks its build time, revision, channel or "
            "hashes.");
        throw BundleUpdateError(BundleUpdateFailure::Verification,
                                "Signed bundle manifest is incomplete");
    }

    if (std::optional<std::string> rollback = rollbackProblem(*manifest, plan.source, active))
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            "Refused the update: the signed manifest would roll back the active bundle, as " +
                *rollback + ".");
        throw BundleUpdateError(BundleUpdateFailure::Verification,
                                "Bundle manifest would roll back the active bundle");
    }

    if (std::optional<std::string> outdated = loaderVersionProblem(*manifest, loaderVersion()))
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            "Refused the update: " + *outdated + ". Update the loader to use this bundle.");
        recordRequiredLoader(documents_, manifest->minLoaderVersion);
        throw BundleUpdateError(BundleUpdateFailure::LoaderTooOld, "Bundle needs a newer loader");
    }
    recordRequiredLoader(documents_, "");

    if (std::optional<std::string> bridge =
            nativeBridgeProblem(*manifest, kNativePluginApiVersion, kNativePluginAbiVersion))
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            "Refused the update: " + *bridge + ". Update the loader to use this bundle.");
        throw BundleUpdateError(BundleUpdateFailure::LoaderTooOld,
                                "Bundle needs a different native bridge");
    }

    auto hash = manifest->sha512.find(urlFileName(plan.url));
    if (hash == manifest->sha512.end())
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            "Refused the update: the signed manifest has no hash for " + urlFileName(plan.url) +
                ".");
        throw BundleUpdateError(BundleUpdateFailure::Verification,
                                "Signed bundle manifest does not list the bundle");
    }

    log(LogLevel::Info, LOG_CATEGORY_UPDATER,
        "Bundle manifest verified with " + describeSigner(signer, trust_) + " (revision " +
            manifest->revision + ", channel " + manifest->channel + ", built " +
            manifest->buildTime + ").");
    plan.manifestText      = *manifestText;
    plan.manifestSignature = *signature;
    plan.expectedSha512    = hash->second;
    return plan;
}

bool BundleUpdater::isActiveManifest(const std::string &url, const std::string &manifestText) const
{
    std::string extension = urlPathExtension(url);
    if (!isSupportedExtension(extension) || preferences::forceUpdate(settings_))
    {
        return false;
    }
    std::string target = bundlePath(extension);
    if (!fileExists(target) || fileExists(target + kBundleCandidateSuffix))
    {
        return false;
    }
    nlohmann::json record = parseBundleRecord(readTextFile(target + kBundleTrustSuffix));
    return bundleRecordField(record, "kind") == "manifest" &&
           bundleRecordField(record, "file") == urlFileName(url) &&
           bundleRecordField(record, "manifest") == manifestText;
}

std::optional<std::string> BundleUpdater::verifiedRecord(const DownloadPlan &plan,
                                                         const std::string  &candidatePath) const
{
    nlohmann::json record{{"url", plan.url},
                          {"source", plan.source},
                          {"file", urlFileName(plan.url)},
                          {"developerMode", developerMode() ? "1" : "0"}};

    if (!plan.exemption.empty())
    {
        record["kind"]      = "exempt";
        record["exemption"] = plan.exemption;
        return record.dump();
    }

    std::optional<std::string> bundle = readTextFile(candidatePath);
    if (!bundle)
    {
        return std::nullopt;
    }

    if (sha512Hex(*bundle) != plan.expectedSha512)
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            "Rejected the downloaded bundle: its SHA-512 does not match the signed manifest.");
        return std::nullopt;
    }
    log(LogLevel::Info, LOG_CATEGORY_UPDATER,
        "Bundle signature verified: " + urlFileName(plan.url) + " matches the signed manifest.");
    if (std::optional<nlohmann::json> identity = fileIdentity(candidatePath))
    {
        record["identity"] = *identity;
    }
    record["kind"]      = "manifest";
    record["manifest"]  = plan.manifestText;
    record["signature"] = plan.manifestSignature;
    return record.dump();
}

std::string bundleFailureNotice(BundleUpdateFailure failure)
{
    switch (failure)
    {
        case BundleUpdateFailure::Network:
            return "Unbound could not download its bundle, so Discord started without it. Check "
                   "your connection and reopen Discord to try again.";
        case BundleUpdateFailure::LoaderTooOld:
            return "Unbound's latest bundle needs a newer loader, so Discord started without it. "
                   "Update Unbound's loader, then reopen Discord.";
        case BundleUpdateFailure::Storage:
            return "Unbound could not save its bundle, so Discord started without it. Free up some "
                   "storage and reopen Discord.";
        case BundleUpdateFailure::Verification:
            break;
    }
    return "Unbound's bundle failed verification, so Discord started without it. Reopen Discord "
           "to try again, and report this to the developers if it keeps happening.";
}

std::optional<double> retryAfterSeconds(const std::string &header)
{
    if (header.empty() || header.size() > 9 ||
        header.find_first_not_of("0123456789") != std::string::npos)
    {
        return std::nullopt;
    }
    return std::stod(header);
}

bool isAcceptedDownloadStatus(int status)
{
    return status == 200 || status == 304;
}

std::optional<std::string> BundleUpdater::spaceProblem() const
{
    std::error_code             error;
    std::filesystem::space_info space = std::filesystem::space(documents_, error);
    if (error || space.available >= kMinimumFreeBytes)
    {
        return std::nullopt;
    }
    return "Not enough space to download the bundle (" +
           std::to_string(space.available / (1024 * 1024)) + " MB free)";
}

std::string BundleUpdater::downloadBundle(const std::string                &preferredPath,
                                          const std::optional<std::string> &updateURL,
                                          uint32_t bytecodeVersion, bool ignorePause)
{
    log(LogLevel::Info, LOG_CATEGORY_UPDATER, "Ensuring bundle is up to date...");

    if (preferredPath.ends_with(kBundleCandidateSuffix) && fileExists(preferredPath))
    {
        return preferredPath;
    }

    bool paused = !preferences::autoClientUpdates(settings_);
    if (paused && ignorePause)
    {
        log(LogLevel::Info, LOG_CATEGORY_UPDATER,
            "Automatic client updates are off, but a manual refetch checks anyway.");
    }
    else if (paused)
    {
        std::string cachedPath = preferredPath.empty() ? resolveBundlePath() : preferredPath;
        std::optional<std::string> problem = pauseProblem(cachedPath, updateURL, bytecodeVersion);
        if (!problem)
        {
            log(LogLevel::Info, LOG_CATEGORY_UPDATER,
                "Automatic client updates are off; keeping the cached bundle.");
            return cachedPath;
        }
        log(LogLevel::Info, LOG_CATEGORY_UPDATER,
            "Automatic client updates are off, but " + *problem + "; checking for a bundle.");
    }

    std::string  storedEtag = preferences::bundleEtag(settings_);
    DownloadPlan plan       = planDownload(updateURL, bytecodeVersion);
    std::string  url        = plan.url;
    if (plan.unchanged)
    {
        log(LogLevel::Info, LOG_CATEGORY_UPDATER, "No update found; the manifest is unchanged.");
        return bundlePath(urlPathExtension(url));
    }

    std::string urlExtension     = urlPathExtension(url);
    std::string currentPath      = preferredPath.empty() ? resolveBundlePath() : preferredPath;
    std::string currentExtension = pathExtension(currentPath);

    if (!isSupportedExtension(urlExtension))
    {
        urlExtension = isSupportedExtension(currentExtension) ? currentExtension : "js";
    }

    std::string targetPath    = bundlePath(urlExtension);
    std::string candidatePath = targetPath + kBundleCandidateSuffix;

    std::map<std::string, std::string> headers;
    bool                               forceUpdate = preferences::forceUpdate(settings_);
    bool                               isVerified  = fileExists(targetPath + kBundleTrustSuffix);
    if (fileExists(targetPath) && !isVerified)
    {
        log(LogLevel::Info, LOG_CATEGORY_UPDATER,
            "The active bundle has no verification record; downloading a verified copy.");
    }
    // The stored ETag belongs to whichever file the active bundle came from, so it only
    // describes the download when the plan selects that same file.
    std::string activeFile =
        bundleRecordField(parseBundleRecord(readTextFile(targetPath + kBundleTrustSuffix)), "file");
    if (fileExists(targetPath) && isVerified && !forceUpdate && !storedEtag.empty() &&
        activeFile == urlFileName(url))
    {
        headers["If-None-Match"] = storedEtag;
    }

    if (std::optional<std::string> problem = spaceProblem())
    {
        throw BundleUpdateError(BundleUpdateFailure::Storage, *problem);
    }

    std::optional<DownloadResult> response =
        download_ ? download_(url, candidatePath, headers, kBundleDownloadPolicy) : std::nullopt;
    if (!response)
    {
        throw BundleUpdateError(BundleUpdateFailure::Network, "Could not download " + url);
    }

    if (!isAcceptedDownloadStatus(response->status))
    {
        removeFile(candidatePath);
        throw BundleUpdateError(BundleUpdateFailure::Network,
                                "Bundle download returned HTTP " + std::to_string(response->status),
                                retryAfterSeconds(response->retryAfter));
    }

    if (response->status == 304)
    {
        log(LogLevel::Info, LOG_CATEGORY_UPDATER, "No update found.");
        return targetPath;
    }

    if (!fileExists(candidatePath))
    {
        throw BundleUpdateError(BundleUpdateFailure::Storage,
                                "Downloaded bundle candidate is unavailable");
    }

    std::optional<std::string> record = verifiedRecord(plan, candidatePath);
    if (!record)
    {
        rejectBundle(candidatePath);
        throw BundleUpdateError(BundleUpdateFailure::Verification,
                                "Downloaded bundle failed signature verification");
    }

    if (!writeTextFileAtomically(candidatePath + kBundleTrustSuffix, *record) ||
        !writeTextFileAtomically(candidatePath + ".etag", response->etag))
    {
        rejectBundle(candidatePath);
        throw BundleUpdateError(BundleUpdateFailure::Storage,
                                "Downloaded bundle metadata could not be saved");
    }

    log(LogLevel::Info, LOG_CATEGORY_UPDATER, "Bundle candidate is ready for validation.");
    return candidatePath;
}

const std::string &BundleUpdater::documents() const
{
    return documents_;
}
}
