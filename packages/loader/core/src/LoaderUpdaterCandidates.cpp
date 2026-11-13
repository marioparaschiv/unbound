#include <stdexcept>

#include "LoaderBundleRecord.h"
#include "LoaderDigestCache.h"
#include "LoaderFiles.h"
#include "LoaderLaunchReport.h"
#include "LoaderLog.h"
#include "LoaderPreferences.h"
#include "LoaderUpdater.h"
#include "NativeBundleTransaction.h"

// The bundle files on disk: checking, promoting, rejecting and rolling back downloaded candidates.
namespace loader {

bool BundleUpdater::isExemptionCurrent(const std::string &reason, const std::string &url) const
{
    if (reason == "unkeyed")
    {
        return !trust_.isEnabled();
    }
    if (reason == "unsigned")
    {
        return preferences::unsignedBundlesAllowed(settings_);
    }
    return reason == "development" && isDevelopmentBundleURL(url);
}

std::optional<std::string> BundleUpdater::candidateProblem(const std::string &candidatePath) const
{
    nlohmann::json record = parseBundleRecord(readTextFile(candidatePath + kBundleTrustSuffix));
    if (record.is_null())
    {
        return std::string("it has no verification record");
    }

    std::string kind = bundleRecordField(record, "kind");
    std::string url  = bundleRecordField(record, "url");
    if (kind == "exempt")
    {
        std::string reason = bundleRecordField(record, "exemption");
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

    std::string source    = bundleRecordField(record, "source");
    std::string signature = bundleRecordField(record, "signature");
    if (kind != "manifest")
    {
        return "its verification record has an unknown kind \"" + kind + "\"";
    }

    std::string manifestText = bundleRecordField(record, "manifest");
    if (verifyTrustedSignature(manifestText, signature, trust_) == TrustedSigner::None)
    {
        return std::string("its stored manifest signature does not match");
    }
    std::optional<BundleManifest> manifest = parseBundleManifest(manifestText);
    if (!manifest || !manifest->isSignable())
    {
        return std::string("its stored manifest is incomplete");
    }
    auto hash = manifest->sha512.find(bundleRecordField(record, "file"));
    if (hash == manifest->sha512.end())
    {
        return std::string("its signed manifest does not list it");
    }
    // The download hashed these exact bytes; an unchanged file skips hashing it again at launch.
    std::optional<nlohmann::json> identity = fileIdentity(candidatePath);
    auto                          verified = record.find("identity");
    if (!identity || verified == record.end() || *verified != *identity)
    {
        std::optional<std::string> bundle = readTextFile(candidatePath);
        if (!bundle)
        {
            return std::string("it could not be read");
        }
        if (hash->second != sha512Hex(*bundle))
        {
            return std::string("its SHA-512 does not match its signed manifest");
        }
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

    for (const char *extension : kBundleExtensions)
    {
        std::string target    = bundlePath(extension);
        std::string candidate = target + kBundleCandidateSuffix;
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
            preferences::setBundleEtag(settings_, "");
        }

        if (fileExists(candidate + ".attempting"))
        {
            log(LogLevel::Warning, LOG_CATEGORY_UPDATER,
                "Discarded the new bundle: Discord closed before it ran long enough to count as "
                "healthy. The active bundle runs instead.");
            setBundleState(BundleState::Discarded);
            discardFailedBundle(candidate);
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

    for (const char *extension : kBundleExtensions)
    {
        std::string path = bundlePath(extension);
        if (fileExists(path))
        {
            return path;
        }
    }

    return bundlePath("bundle");
}

void BundleUpdater::recordBaseline(const std::string &record)
{
    nlohmann::json parsed = parseBundleRecord(record);
    if (bundleRecordField(parsed, "kind") != "manifest")
    {
        preferences::setBundleBaseline(settings_, "");
        return;
    }

    std::optional<BundleManifest> manifest =
        parseBundleManifest(bundleRecordField(parsed, "manifest"));
    if (!manifest)
    {
        preferences::setBundleBaseline(settings_, "");
        return;
    }
    preferences::setBundleBaseline(settings_, serializeBaseline(baselineFromManifest(
                                                  *manifest, bundleRecordField(parsed, "source"))));
}

bool BundleUpdater::markBundleAttempted(const std::string &path)
{
    if (!path.ends_with(kBundleCandidateSuffix))
    {
        return true;
    }
    return writeTextFileAtomically(path + ".attempting", "1");
}

bool BundleUpdater::acceptBundle(const std::string &path)
{
    if (!path.ends_with(kBundleCandidateSuffix))
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

    std::string targetPath    = path.substr(0, path.size() - kBundleCandidateSuffix.size());
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

    // The replaced bundle's record goes with its backup, so a rollback restores both.
    if (std::optional<std::string> replaced = readTextFile(targetPath + kBundleTrustSuffix);
        replaced && hadTarget == "1")
    {
        writeTextFileAtomically(backupPath + kBundleTrustSuffix, *replaced);
    }
    else
    {
        removeFile(backupPath + kBundleTrustSuffix);
    }

    std::optional<std::string> record = readTextFile(path + kBundleTrustSuffix);
    if (!record || !writeTextFileAtomically(targetPath + kBundleTrustSuffix, *record))
    {
        removeFile(targetPath + kBundleTrustSuffix);
    }
    recordBaseline(record.value_or(""));
    removeFile(path + kBundleTrustSuffix);

    std::optional<std::string> etag = readTextFile(path + ".etag");
    preferences::setBundleEtag(settings_, etag.value_or(""));
    removeFile(path + ".etag");
    removeFile(path + ".attempting");

    for (const char *extension : kBundleExtensions)
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

void BundleUpdater::discardFailedBundle(const std::string &path)
{
    nlohmann::json record = parseBundleRecord(readTextFile(path + kBundleTrustSuffix));
    std::optional<BundleManifest> manifest =
        parseBundleManifest(bundleRecordField(record, "manifest"));
    if (manifest && !manifest->revision.empty())
    {
        preferences::setRejectedRevision(settings_, manifest->revision);
        log(LogLevel::Warning, LOG_CATEGORY_UPDATER,
            "Build " + manifest->revision +
                " failed on this device; it is skipped until a newer build is published.");
    }
    rejectBundle(path);
}

std::optional<std::string> BundleUpdater::integrityProblem(const std::string &path)
{
    if (fileSize(path) == 0)
    {
        return std::string("it is empty");
    }
    nlohmann::json record = parseBundleRecord(readTextFile(path + kBundleTrustSuffix));
    if (record.is_null() || bundleRecordField(record, "kind") != "manifest")
    {
        return std::nullopt;
    }
    std::optional<BundleManifest> manifest =
        parseBundleManifest(bundleRecordField(record, "manifest"));
    if (!manifest)
    {
        return std::nullopt;
    }
    auto hash = manifest->sha512.find(bundleRecordField(record, "file"));
    if (hash == manifest->sha512.end())
    {
        return std::nullopt;
    }
    std::optional<nlohmann::json> identity = fileIdentity(path);
    auto                          verified = record.find("identity");
    if (identity && verified != record.end() && *verified == *identity)
    {
        return std::nullopt;
    }
    std::optional<std::string> bundle = readTextFile(path);
    if (!bundle)
    {
        return std::string("it could not be read");
    }
    if (sha512Hex(*bundle) != hash->second)
    {
        return std::string("its SHA-512 no longer matches its signed manifest");
    }
    if (identity)
    {
        record["identity"] = *identity;
        writeTextFileAtomically(path + kBundleTrustSuffix, record.dump());
    }
    return std::nullopt;
}

void BundleUpdater::healDamagedBundle(const std::string &path)
{
    if (path.ends_with(kBundleCandidateSuffix))
    {
        rejectBundle(path);
        return;
    }
    removeFile(path);
    removeFile(path + kBundleTrustSuffix);
    preferences::setBundleEtag(settings_, "");
}

void BundleUpdater::rejectBundle(const std::string &path)
{
    if (!path.ends_with(kBundleCandidateSuffix))
    {
        return;
    }
    removeFile(path);
    removeFile(path + ".etag");
    removeFile(path + ".attempting");
    removeFile(path + kBundleTrustSuffix);
}

bool BundleUpdater::rollBackToPrevious()
{
    for (const char *extension : kBundleExtensions)
    {
        std::string target = bundlePath(extension);
        std::string backup = target + ".previous";
        if (!fileExists(target) || !fileExists(backup) || fileSize(backup) == 0)
        {
            continue;
        }
        if (!restoreNativeBundle(backup.c_str(), target.c_str()))
        {
            log(LogLevel::Error, LOG_CATEGORY_UPDATER,
                "Failed to roll back to the previous bundle.");
            return false;
        }
        // Keeping the ETag and baseline of the bundle that failed makes the next check answer
        // 304 for it, so it is not downloaded again; a newer build replaces it as usual.
        if (std::optional<std::string> record = readTextFile(backup + kBundleTrustSuffix))
        {
            writeTextFileAtomically(target + kBundleTrustSuffix, *record);
        }
        removeFile(backup);
        removeFile(backup + kBundleTrustSuffix);
        log(LogLevel::Warning, LOG_CATEGORY_UPDATER, "Rolled back to the previous bundle.");
        return true;
    }
    return false;
}

std::optional<std::string> BundleUpdater::previousBundleRevision() const
{
    for (const char *extension : kBundleExtensions)
    {
        std::string target = bundlePath(extension);
        std::string backup = target + ".previous";
        if (!fileExists(target) || !fileExists(backup) || fileSize(backup) == 0)
        {
            continue;
        }
        std::optional<BundleManifest> manifest = parseBundleManifest(bundleRecordField(
            parseBundleRecord(readTextFile(backup + kBundleTrustSuffix)), "manifest"));
        return manifest ? manifest->revision : std::string();
    }
    return std::nullopt;
}
}
