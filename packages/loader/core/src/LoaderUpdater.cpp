#include "LoaderUpdater.h"

#include <algorithm>
#include <cctype>
#include <filesystem>
#include <regex>
#include <stdexcept>

#include "LoaderBundlePatch.h"
#include "LoaderBundleRecord.h"
#include "LoaderCaptivePortal.h"
#include "LoaderDigestCache.h"
#include "LoaderFiles.h"
#include "LoaderLog.h"
#include "LoaderPreferences.h"
#include "LoaderRequiredLoader.h"
#include "LoaderStrings.h"
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
    std::string path = url.substr(0, url.find_first_of("?#"));
    size_t slash     = path.find_last_of('/');
    size_t dot       = path.find_last_of('.');
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
    std::string path = url.substr(0, url.find_first_of("?#"));
    size_t slash     = path.find_last_of('/');
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
    std::string path = url.substr(0, url.find_first_of("?#"));
    size_t slash     = path.find_last_of('/');
    return slash == std::string::npos ? path : path.substr(slash + 1);
}

double BundleUpdater::serverMaxAgeSeconds() const
{
    return serverMaxAge_->load();
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
    return preferences::wantsDevelopmentBundle(settings_);
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

std::string BundleUpdater::selectURL(const BundleSource &source,
                                     const std::optional<BundleManifest> &manifest,
                                     uint32_t bytecodeVersion) const
{
    if (!manifest)
    {
        std::string fallback = source.directURL.value_or(source.baseURL + "unbound.js");
        log(LogLevel::Warning, LOG_CATEGORY_UPDATER,
            "No usable manifest at " + source.baseURL + kBundleManifestName + "; falling back to "
                + fallback);
        return fallback;
    }

    std::string versions;
    for (uint32_t version : manifest->bytecodeVersions)
    {
        versions += (versions.empty() ? "" : ",") + std::to_string(version);
    }

    log(LogLevel::Info, LOG_CATEGORY_UPDATER,
        "Manifest bytecode versions: [" + versions
            + "], Current bytecode version: " + std::to_string(bytecodeVersion));

    std::string file = manifest->bundleFile(bytecodeVersion, developerMode());
    log(LogLevel::Info, LOG_CATEGORY_UPDATER,
        file.ends_with(".js") ? "Using JavaScript bundle" : "Using hermes bytecode bundle");
    return source.baseURL + file;
}

std::string BundleUpdater::downloadURL(const std::optional<std::string> &updateURL,
                                       uint32_t bytecodeVersion)
{
    BundleSource source                     = bundleSource(updateURL);
    std::optional<std::string> manifestText = fetch(source.baseURL + kBundleManifestName);
    return selectURL(source, manifestText ? parseBundleManifest(*manifestText) : std::nullopt,
                     bytecodeVersion);
}

BundleUpdater::DownloadPlan BundleUpdater::planDownload(const std::optional<std::string> &updateURL,
                                                        uint32_t bytecodeVersion)
{
    BundleSource source                     = bundleSource(updateURL);
    std::string manifestURL                 = source.baseURL + kBundleManifestName;
    std::optional<std::string> manifestText = fetch(manifestURL);
    std::optional<BundleManifest> manifest =
        manifestText ? parseBundleManifest(*manifestText) : std::nullopt;

    DownloadPlan plan;
    plan.url    = selectURL(source, manifest, bytecodeVersion);
    plan.file   = urlFileName(plan.url);
    plan.source = source.baseURL;

    if (std::optional<std::string> exemption = exemptionFor(plan.url))
    {
        plan.exemption = *exemption;
        return plan;
    }

    if (manifest && !manifest->revision.empty() && !preferences::forceUpdate(settings_)
        && manifest->revision == preferences::rejectedRevision(settings_))
    {
        log(LogLevel::Info, LOG_CATEGORY_UPDATER,
            "Skipped build " + manifest->revision
                + ", which failed on this device; waiting for a newer one.");
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

    if (!manifestText)
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER, "Could not fetch " + manifestURL + ".");
        throw BundleUpdateError(BundleUpdateFailure::Network, "Could not fetch " + manifestURL);
    }

    plan.manifestText = *manifestText;
    if (manifest)
    {
        // Saves a round trip before the bundle download, whose bytes count only once
        // verifyPlan has checked this signature.
        plan.signature =
            std::async(std::launch::async, [this, url = manifestURL + kBundleSignatureSuffix]() {
                return fetch(url);
            }).share();
        if (auto patches = manifest->patches.find(plan.file); patches != manifest->patches.end())
        {
            plan.patchBases = patches->second;
        }
    }

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
    return bundleRecordField(record, "kind") == "manifest"
           && bundleRecordField(record, "file") == urlFileName(url)
           && bundleRecordField(record, "manifest") == manifestText;
}

static std::string loaderTooOldNotice(LoaderInstall install)
{
    switch (install)
    {
        case LoaderInstall::Apk:
            return text("UNBOUND_NATIVE_OUTDATED_APK",
                        "This version of Unbound is out of date, so Discord opened without it. "
                        "Install the latest Unbound APK, then reopen Discord.");
        case LoaderInstall::Ipa:
            return text("UNBOUND_NATIVE_OUTDATED_IPA",
                        "This version of Unbound is out of date, so Discord opened without it. "
                        "Install the latest Unbound IPA, then reopen Discord.");
        case LoaderInstall::Tweak:
            return text("UNBOUND_NATIVE_OUTDATED_TWEAK",
                        "This version of Unbound is out of date, so Discord opened without it. "
                        "Update the Unbound tweak in your package manager, then reopen Discord.");
        case LoaderInstall::Unknown:
            break;
    }

    return text("UNBOUND_NATIVE_OUTDATED",
                "Unbound's latest bundle needs a newer loader, so Discord started without it. "
                "Update Unbound's loader, then reopen Discord.");
}

std::string bundleFailureNotice(BundleUpdateFailure failure, LoaderInstall install)
{
    switch (failure)
    {
        case BundleUpdateFailure::Network:
            return text("UNBOUND_NATIVE_BUNDLE_NETWORK",
                        "Unbound could not download its bundle, so Discord started without it. "
                        "Check your connection and reopen Discord to try again.");
        case BundleUpdateFailure::LoaderTooOld:
            return loaderTooOldNotice(install);
        case BundleUpdateFailure::Storage:
            return text("UNBOUND_NATIVE_BUNDLE_STORAGE",
                        "Unbound could not save its bundle, so Discord started without it. Free up "
                        "some storage and reopen Discord.");
        case BundleUpdateFailure::Verification:
            break;
    }

    return text("UNBOUND_NATIVE_BUNDLE_VERIFICATION",
                "Unbound's bundle failed verification, so Discord started without it. Reopen "
                "Discord to try again, and report this to the developers if it keeps happening.");
}

std::optional<double> maxAgeSeconds(const std::string &cacheControl)
{
    static const std::regex kMaxAge(R"((?:^|[,\s])max-age\s*=\s*(\d+))", std::regex::icase);
    std::smatch match;
    if (!std::regex_search(cacheControl, match, kMaxAge))
    {
        return std::nullopt;
    }

    return std::stod(match[1].str());
}

std::optional<double> retryAfterSeconds(const std::string &header)
{
    if (header.empty() || header.size() > 9
        || header.find_first_not_of("0123456789") != std::string::npos)
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
    std::error_code error;
    std::filesystem::space_info space = std::filesystem::space(documents_, error);
    if (error || space.available >= kMinimumFreeBytes)
    {
        return std::nullopt;
    }

    return "Not enough space to download the bundle ("
           + std::to_string(space.available / (1024 * 1024)) + " MB free)";
}

std::string BundleUpdater::downloadBundle(const std::string &preferredPath,
                                          const std::optional<std::string> &updateURL,
                                          uint32_t bytecodeVersion, bool ignorePause)
{
    log(LogLevel::Info, LOG_CATEGORY_UPDATER, "Ensuring bundle is up to date...");

    if (preferredPath.ends_with(kBundleCandidateSuffix) && fileExists(preferredPath))
    {
        return preferredPath;
    }

    if (ignorePause && !preferences::autoClientUpdates(settings_))
    {
        log(LogLevel::Info, LOG_CATEGORY_UPDATER,
            "Automatic client updates are off, but a manual refetch checks anyway.");
    }
    else if (std::optional<std::string> cachedPath =
                 pausedBundle(preferredPath, updateURL, bytecodeVersion))
    {
        return *cachedPath;
    }

    std::string storedEtag = preferences::bundleEtag(settings_);
    DownloadPlan plan      = planDownload(updateURL, bytecodeVersion);
    std::string url        = plan.url;
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
    bool forceUpdate = preferences::forceUpdate(settings_);
    bool isVerified  = fileExists(targetPath + kBundleTrustSuffix);
    if (fileExists(targetPath) && !isVerified)
    {
        log(LogLevel::Info, LOG_CATEGORY_UPDATER,
            "The active bundle has no verification record; downloading a verified copy.");
    }

    // The stored ETag belongs to whichever file the active bundle came from, so it only
    // describes the download when the plan selects that same file.
    std::string activeFile =
        bundleRecordField(parseBundleRecord(readTextFile(targetPath + kBundleTrustSuffix)), "file");
    if (fileExists(targetPath) && isVerified && !forceUpdate && !storedEtag.empty()
        && activeFile == urlFileName(url))
    {
        headers["If-None-Match"] = storedEtag;
    }

    if (std::optional<std::string> problem = spaceProblem())
    {
        throw BundleUpdateError(BundleUpdateFailure::Storage, *problem);
    }

    // A patch applies only against hashes from the verified manifest, so it waits for the
    // signature; a whole download runs while the signature is fetched.
    if (isVerified && !forceUpdate && activeFile == urlFileName(url) && !plan.patchBases.empty())
    {
        verifyPlan(plan);
        if (std::optional<std::string> record = patchedCandidate(plan, targetPath, candidatePath))
        {
            if (writeTextFileAtomically(candidatePath + kBundleTrustSuffix, *record)
                && writeTextFileAtomically(candidatePath + ".etag", ""))
            {
                log(LogLevel::Info, LOG_CATEGORY_UPDATER,
                    "Bundle candidate is ready for validation, patched from the active bundle.");
                return candidatePath;
            }

            removeFile(candidatePath);
        }
    }

    std::optional<DownloadResult> response =
        download_ ? download_(url, candidatePath, headers, kBundleDownloadPolicy) : std::nullopt;
    try
    {
        verifyPlan(plan);
    }
    catch (const BundleUpdateError &)
    {
        removeFile(candidatePath);
        throw;
    }

    if (!response)
    {
        throw BundleUpdateError(BundleUpdateFailure::Network, "Could not download " + url);
    }

    serverMaxAge_->store(maxAgeSeconds(response->cacheControl).value_or(0));

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

    if (!writeTextFileAtomically(candidatePath + kBundleTrustSuffix, *record)
        || !writeTextFileAtomically(candidatePath + ".etag", response->etag))
    {
        rejectBundle(candidatePath);
        throw BundleUpdateError(BundleUpdateFailure::Storage,
                                "Downloaded bundle metadata could not be saved");
    }

    log(LogLevel::Info, LOG_CATEGORY_UPDATER, "Bundle candidate is ready for validation.");
    return candidatePath;
}

// A patch turns the active bundle into the new one; any failure leaves the full download to run.
std::optional<std::string> BundleUpdater::patchedCandidate(const DownloadPlan &plan,
                                                           const std::string &targetPath,
                                                           const std::string &candidatePath) const
{
    if (plan.patchBases.empty() || !download_)
    {
        return std::nullopt;
    }

    std::optional<std::string> active = readTextFile(targetPath);
    if (!active)
    {
        return std::nullopt;
    }

    std::optional<std::string> base = patchBaseFor(plan.patchBases, sha512Hex(*active));
    if (!base)
    {
        return std::nullopt;
    }

    std::string patchURL  = plan.source + bundlePatchPath(urlFileName(plan.url), *base);
    std::string patchPath = candidatePath + ".patch";
    std::optional<DownloadResult> response =
        download_(patchURL, patchPath, {}, kBundleDownloadPolicy);
    std::optional<std::string> patch =
        response && response->status == 200 ? readTextFile(patchPath) : std::nullopt;
    removeFile(patchPath);
    std::optional<std::string> patched = patch ? applyBundlePatch(*active, *patch) : std::nullopt;
    if (!patched || !writeTextFileAtomically(candidatePath, *patched))
    {
        log(LogLevel::Warning, LOG_CATEGORY_UPDATER,
            "Could not patch the active bundle from " + patchURL + "; downloading it whole.");
        return std::nullopt;
    }

    std::optional<std::string> record = verifiedRecord(plan, candidatePath);
    if (!record)
    {
        removeFile(candidatePath);
        log(LogLevel::Warning, LOG_CATEGORY_UPDATER,
            "The patched bundle did not match the signed manifest; downloading it whole.");
        return std::nullopt;
    }

    log(LogLevel::Info, LOG_CATEGORY_UPDATER,
        "Patched the bundle with " + std::to_string(patch->size()) + " bytes instead of "
            + std::to_string(patched->size()) + ".");
    return record;
}

const std::string &BundleUpdater::documents() const
{
    return documents_;
}

bool BundleUpdater::behindCaptivePortal() const
{
    CaptiveProbe probe = platformCaptiveProbe();
    return isCaptivePortal(fetchText_(probe.url, kManifestFetchTimeoutSeconds), probe);
}
}
