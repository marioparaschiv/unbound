#include "LoaderUpdater.h"

#include <algorithm>
#include <cctype>
#include <stdexcept>

#include "LoaderFiles.h"
#include "LoaderLog.h"
#include "NativeBundleTransaction.h"
#include "NativePluginVersion.h"

namespace loader {
static const char *const kExtensions[]    = {"bundle", "js"};
static const std::string kCandidateSuffix = ".candidate";

static bool hasSuffix(const std::string &value, const std::string &suffix)
{
    return value.size() >= suffix.size() &&
           value.compare(value.size() - suffix.size(), suffix.size(), suffix) == 0;
}

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

UpdaterSettings updaterSettings(SettingsStore &store)
{
    UpdaterSettings settings;
    settings.getString = [&store](const std::string &key, const std::string &fallback) {
        return store.getString("unbound", key, fallback);
    };
    settings.getBoolean = [&store](const std::string &key, bool fallback) {
        return store.getBoolean("unbound", key, fallback);
    };
    settings.setString = [&store](const std::string &key, const std::string &value) {
        store.set("unbound", key, value);
        store.save();
    };
    return settings;
}

BundleUpdater::BundleUpdater(std::string documents, UpdaterSettings settings, TextFetcher fetchText,
                             FileDownloader download, BundleTrust trust)
    : documents_(std::move(documents)), settings_(std::move(settings)),
      fetchText_(std::move(fetchText)), download_(std::move(download)), trust_(std::move(trust))
{
}

static std::string urlFileName(const std::string &url)
{
    std::string path  = url.substr(0, url.find_first_of("?#"));
    size_t      slash = path.find_last_of('/');
    return slash == std::string::npos ? path : path.substr(slash + 1);
}

static nlohmann::json parseRecord(const std::optional<std::string> &text)
{
    if (!text)
    {
        return nlohmann::json();
    }
    nlohmann::json record = nlohmann::json::parse(*text, nullptr, false);
    return record.is_object() ? record : nlohmann::json();
}

static std::string recordField(const nlohmann::json &record, const char *key)
{
    auto field = record.find(key);
    return field != record.end() && field->is_string() ? field->get<std::string>() : "";
}

std::optional<std::string> BundleUpdater::fetch(const std::string &url) const
{
    return fetchText_ ? fetchText_(url, kManifestFetchTimeoutSeconds) : std::nullopt;
}

std::optional<BundleBaseline> BundleUpdater::baseline() const
{
    return parseBaseline(settings_.getString(kBundleBaselineSetting, ""));
}

std::optional<std::string> BundleUpdater::exemptionFor(const std::string &url) const
{
    if (!trust_.isEnabled())
    {
        log(LogLevel::Info, LOG_CATEGORY_UPDATER,
            "Bundle signature check skipped: this loader was built without a signing key.");
        return "unkeyed";
    }

    if (settings_.getBoolean("loader.update.unsigned", false))
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

bool BundleUpdater::isExemptionCurrent(const std::string &reason, const std::string &url) const
{
    if (reason == "unkeyed")
    {
        return !trust_.isEnabled();
    }
    if (reason == "unsigned")
    {
        return settings_.getBoolean("loader.update.unsigned", false);
    }
    return reason == "development" && isDevelopmentBundleURL(url);
}

std::string BundleUpdater::bundlePath(const std::string &extension) const
{
    return joinPath(documents_, "unbound." + extension);
}

std::optional<std::string> BundleUpdater::candidateProblem(const std::string &candidatePath) const
{
    nlohmann::json record = parseRecord(readTextFile(candidatePath + kBundleTrustSuffix));
    if (record.is_null())
    {
        return std::string("it has no verification record, so an older loader downloaded it");
    }

    std::string kind = recordField(record, "kind");
    std::string url  = recordField(record, "url");
    if (kind == "exempt")
    {
        std::string reason = recordField(record, "exemption");
        if (!isExemptionCurrent(reason, url))
        {
            return "it was downloaded without verification (" + reason +
                   "), which no longer applies";
        }
        return std::nullopt;
    }

    if (!trust_.isEnabled())
    {
        return std::nullopt;
    }

    std::optional<std::string> bundle = readTextFile(candidatePath);
    if (!bundle)
    {
        return std::string("it could not be read");
    }

    std::string source    = recordField(record, "source");
    std::string signature = recordField(record, "signature");
    if (kind == "bundle")
    {
        return std::string("it was verified by its own signature, without a signed manifest");
    }

    if (kind != "manifest")
    {
        return "its verification record has an unknown kind \"" + kind + "\"";
    }

    std::string manifestText = recordField(record, "manifest");
    if (verifyTrustedSignature(manifestText, signature, trust_) == TrustedSigner::None)
    {
        return std::string("its stored manifest signature does not match");
    }
    std::optional<BundleManifest> manifest = parseBundleManifest(manifestText);
    if (!manifest || !manifest->isSignable())
    {
        return std::string("its stored manifest is incomplete");
    }
    auto hash = manifest->sha512.find(recordField(record, "file"));
    if (hash == manifest->sha512.end() || hash->second != sha512Hex(*bundle))
    {
        return std::string("its SHA-512 does not match its signed manifest");
    }
    if (std::optional<std::string> rollback = rollbackProblem(*manifest, source, baseline()))
    {
        return rollback;
    }
    return std::nullopt;
}

std::string BundleUpdater::resolveBundlePath()
{
    createDirectories(documents_);

    for (const char *extension : kExtensions)
    {
        std::string target    = bundlePath(extension);
        std::string candidate = target + kCandidateSuffix;
        std::string promoting = candidate + ".promoting";

        if (fileExists(promoting))
        {
            std::string                backup    = target + ".previous";
            std::optional<std::string> hadTarget = readTextFile(promoting);
            if (!hadTarget || (*hadTarget != "0" && *hadTarget != "1"))
            {
                throw std::runtime_error("Interrupted bundle update marker is invalid");
            }
            if (!fileExists(candidate) && *hadTarget == "1" &&
                !restoreNativeBundle(backup.c_str(), target.c_str()))
            {
                throw std::runtime_error("Interrupted bundle update could not be restored");
            }
            rejectBundle(candidate);
            removeFile(target + kBundleTrustSuffix);
            removeFile(promoting);
            settings_.setString("loader.update.etag", "");
        }

        if (fileExists(candidate + ".attempting"))
        {
            rejectBundle(candidate);
        }

        if (fileExists(candidate))
        {
            if (!fileExists(candidate + ".etag") || fileSize(candidate) == 0)
            {
                rejectBundle(candidate);
                continue;
            }
            if (std::optional<std::string> problem = candidateProblem(candidate))
            {
                log(LogLevel::Error, LOG_CATEGORY_UPDATER,
                    "Discarded the bundle candidate: " + *problem +
                        ". A verified copy will be "
                        "downloaded.");
                rejectBundle(candidate);
                continue;
            }
            return candidate;
        }
    }

    for (const char *extension : kExtensions)
    {
        std::string path = bundlePath(extension);
        if (fileExists(path))
        {
            return path;
        }
    }

    return bundlePath("bundle");
}

BundleUpdater::BundleSource
BundleUpdater::bundleSource(const std::optional<std::string> &updateURL) const
{
    BundleSource source{updateURL.value_or(kDefaultBundleBaseURL), std::nullopt};

    if (hasSuffix(source.baseURL, ".bundle") || hasSuffix(source.baseURL, ".js"))
    {
        source.directURL = source.baseURL;
        source.baseURL   = directoryOfURL(source.baseURL);
    }

    if (!hasSuffix(source.baseURL, "/"))
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
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            "Failed to fetch manifest; falling back to JavaScript bundle");
        return source.directURL.value_or(source.baseURL + "unbound.js");
    }

    std::string versions;
    for (uint32_t version : manifest->bytecodeVersions)
    {
        versions += (versions.empty() ? "" : ",") + std::to_string(version);
    }
    log(LogLevel::Info, LOG_CATEGORY_UPDATER,
        "Manifest bytecode versions: [" + versions +
            "], Current bytecode version: " + std::to_string(bytecodeVersion));

    std::string file = manifest->bundleFile(bytecodeVersion);
    log(LogLevel::Info, LOG_CATEGORY_UPDATER,
        file == "unbound.js" ? "Using JavaScript bundle" : "Using hermes bytecode bundle");
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

    std::optional<std::string> signature =
        manifest ? fetch(manifestURL + kBundleSignatureSuffix) : std::nullopt;
    TrustedSigner signer =
        signature ? verifyTrustedSignature(*manifestText, *signature, trust_) : TrustedSigner::None;
    std::optional<BundleBaseline> active = baseline();

    if (signer == TrustedSigner::None)
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            "Refused the update: " + manifestURL + " has no valid signature.");
        throw std::runtime_error("Bundle manifest failed signature verification");
    }

    if (!manifest->isSignable())
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            "Refused the update: the signed manifest lacks its build time, revision, channel or "
            "hashes.");
        throw std::runtime_error("Signed bundle manifest is incomplete");
    }

    if (std::optional<std::string> rollback = rollbackProblem(*manifest, plan.source, active))
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            "Refused the update: the signed manifest would roll back the active bundle, as " +
                *rollback + ".");
        throw std::runtime_error("Bundle manifest would roll back the active bundle");
    }

    if (std::optional<std::string> bridge =
            nativeBridgeProblem(*manifest, kNativePluginApiVersion, kNativePluginAbiVersion))
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            "Refused the update: " + *bridge + ". Update the loader to use this bundle.");
        throw std::runtime_error("Bundle needs a different native bridge");
    }

    auto hash = manifest->sha512.find(urlFileName(plan.url));
    if (hash == manifest->sha512.end())
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            "Refused the update: the signed manifest has no hash for " + urlFileName(plan.url) +
                ".");
        throw std::runtime_error("Signed bundle manifest does not list the bundle");
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

std::optional<std::string> BundleUpdater::verifiedRecord(const DownloadPlan &plan,
                                                         const std::string  &candidatePath) const
{
    nlohmann::json record{
        {"url", plan.url}, {"source", plan.source}, {"file", urlFileName(plan.url)}};

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
    record["kind"]      = "manifest";
    record["manifest"]  = plan.manifestText;
    record["signature"] = plan.manifestSignature;
    return record.dump();
}

void BundleUpdater::recordBaseline(const std::string &record)
{
    nlohmann::json parsed = parseRecord(record);
    if (recordField(parsed, "kind") != "manifest")
    {
        settings_.setString(kBundleBaselineSetting, "");
        return;
    }

    std::optional<BundleManifest> manifest = parseBundleManifest(recordField(parsed, "manifest"));
    if (!manifest)
    {
        settings_.setString(kBundleBaselineSetting, "");
        return;
    }
    settings_.setString(kBundleBaselineSetting, serializeBaseline(baselineFromManifest(
                                                    *manifest, recordField(parsed, "source"))));
}

bool isAcceptedDownloadStatus(int status)
{
    return status == 200 || status == 304;
}

std::string BundleUpdater::downloadBundle(const std::string                &preferredPath,
                                          const std::optional<std::string> &updateURL,
                                          uint32_t                          bytecodeVersion)
{
    log(LogLevel::Info, LOG_CATEGORY_UPDATER, "Ensuring bundle is up to date...");

    if (hasSuffix(preferredPath, kCandidateSuffix) && fileExists(preferredPath))
    {
        return preferredPath;
    }

    std::string  storedEtag = settings_.getString("loader.update.etag", "");
    DownloadPlan plan       = planDownload(updateURL, bytecodeVersion);
    std::string  url        = plan.url;

    std::string urlExtension     = urlPathExtension(url);
    std::string currentPath      = preferredPath.empty() ? resolveBundlePath() : preferredPath;
    std::string currentExtension = pathExtension(currentPath);

    if (!isSupportedExtension(urlExtension))
    {
        urlExtension = isSupportedExtension(currentExtension) ? currentExtension : "js";
    }

    std::string targetPath    = bundlePath(urlExtension);
    std::string candidatePath = targetPath + kCandidateSuffix;

    std::map<std::string, std::string> headers;
    bool forceUpdate = settings_.getBoolean("loader.update.force", false);
    bool isVerified  = fileExists(targetPath + kBundleTrustSuffix);
    if (fileExists(targetPath) && !isVerified)
    {
        log(LogLevel::Info, LOG_CATEGORY_UPDATER,
            "The active bundle has no verification record; downloading a verified copy.");
    }
    if (fileExists(targetPath) && isVerified && !forceUpdate && !storedEtag.empty())
    {
        headers["If-None-Match"] = storedEtag;
    }

    std::optional<DownloadResult> response =
        download_ ? download_(url, candidatePath, headers, kBundleDownloadPolicy) : std::nullopt;
    if (!response)
    {
        throw std::runtime_error("Could not download " + url);
    }

    if (!isAcceptedDownloadStatus(response->status))
    {
        removeFile(candidatePath);
        throw std::runtime_error("Bundle download returned HTTP " +
                                 std::to_string(response->status));
    }

    if (response->status == 304)
    {
        log(LogLevel::Info, LOG_CATEGORY_UPDATER, "No update found.");
        return targetPath;
    }

    if (!fileExists(candidatePath))
    {
        throw std::runtime_error("Downloaded bundle candidate is unavailable");
    }

    std::optional<std::string> record = verifiedRecord(plan, candidatePath);
    if (!record)
    {
        rejectBundle(candidatePath);
        throw std::runtime_error("Downloaded bundle failed signature verification");
    }

    if (!writeTextFileAtomically(candidatePath + kBundleTrustSuffix, *record) ||
        !writeTextFileAtomically(candidatePath + ".etag", response->etag))
    {
        rejectBundle(candidatePath);
        throw std::runtime_error("Downloaded bundle metadata could not be saved");
    }

    log(LogLevel::Info, LOG_CATEGORY_UPDATER, "Bundle candidate is ready for validation.");
    return candidatePath;
}

bool BundleUpdater::markBundleAttempted(const std::string &path)
{
    if (!hasSuffix(path, kCandidateSuffix))
    {
        return true;
    }
    return writeTextFileAtomically(path + ".attempting", "1");
}

bool BundleUpdater::acceptBundle(const std::string &path)
{
    if (!hasSuffix(path, kCandidateSuffix))
    {
        return true;
    }

    if (std::optional<std::string> problem = candidateProblem(path))
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            "Refused to promote the bundle candidate: " + *problem + ".");
        rejectBundle(path);
        return false;
    }

    std::string targetPath    = path.substr(0, path.size() - kCandidateSuffix.size());
    std::string backupPath    = targetPath + ".previous";
    std::string promotingPath = path + ".promoting";
    std::string hadTarget     = fileExists(targetPath) ? "1" : "0";

    if (!writeTextFileAtomically(promotingPath, hadTarget))
    {
        return false;
    }

    if (!promoteNativeBundle(path.c_str(), targetPath.c_str(), backupPath.c_str()))
    {
        removeFile(promotingPath);
        return false;
    }

    std::optional<std::string> record = readTextFile(path + kBundleTrustSuffix);
    if (!record || !writeTextFileAtomically(targetPath + kBundleTrustSuffix, *record))
    {
        removeFile(targetPath + kBundleTrustSuffix);
    }
    recordBaseline(record.value_or(""));
    removeFile(path + kBundleTrustSuffix);

    std::optional<std::string> etag = readTextFile(path + ".etag");
    settings_.setString("loader.update.etag", etag.value_or(""));
    removeFile(path + ".etag");
    removeFile(path + ".attempting");

    for (const char *extension : kExtensions)
    {
        std::string otherPath = bundlePath(extension);
        if (otherPath != targetPath)
        {
            removeFile(otherPath);
            removeFile(otherPath + kBundleTrustSuffix);
        }
    }

    removeFile(promotingPath);
    return true;
}

void BundleUpdater::rejectBundle(const std::string &path)
{
    if (!hasSuffix(path, kCandidateSuffix))
    {
        return;
    }
    removeFile(path);
    removeFile(path + ".etag");
    removeFile(path + ".attempting");
    removeFile(path + kBundleTrustSuffix);
}
}
