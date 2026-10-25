#include "LoaderUpdater.h"

#include <algorithm>
#include <cctype>
#include <stdexcept>

#include "LoaderFiles.h"
#include "LoaderLog.h"
#include "NativeBundleTransaction.h"

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
                             FileDownloader download)
    : documents_(std::move(documents)), settings_(std::move(settings)),
      fetchText_(std::move(fetchText)), download_(std::move(download))
{
}

std::string BundleUpdater::bundlePath(const std::string &extension) const
{
    return joinPath(documents_, "unbound." + extension);
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

std::string BundleUpdater::downloadURL(const std::optional<std::string> &updateURL,
                                       uint32_t                          bytecodeVersion)
{
    std::string                baseURL = updateURL.value_or(kDefaultBundleBaseURL);
    std::optional<std::string> directURL;

    if (hasSuffix(baseURL, ".bundle") || hasSuffix(baseURL, ".js"))
    {
        directURL = baseURL;
        baseURL   = directoryOfURL(baseURL);
    }

    if (!hasSuffix(baseURL, "/"))
    {
        baseURL += "/";
    }

    std::optional<std::string> manifestText =
        fetchText_ ? fetchText_(baseURL + "manifest.json", kManifestFetchTimeoutSeconds)
                   : std::nullopt;
    if (manifestText)
    {
        nlohmann::json manifest = nlohmann::json::parse(*manifestText, nullptr, false);
        if (!manifest.is_discarded() && manifest.is_object())
        {
            auto versions = manifest.find("bytecodeVersions");
            log(LogLevel::Info, LOG_CATEGORY_UPDATER,
                "Manifest bytecode versions: " +
                    (versions == manifest.end() ? std::string("none") : versions->dump()) +
                    ", Current bytecode version: " + std::to_string(bytecodeVersion));

            if (versions != manifest.end() && versions->is_array())
            {
                for (const nlohmann::json &version : *versions)
                {
                    if (version.is_number_unsigned() && version.get<uint32_t>() == bytecodeVersion)
                    {
                        log(LogLevel::Info, LOG_CATEGORY_UPDATER, "Using hermes bytecode bundle");
                        return baseURL + "unbound." + std::to_string(bytecodeVersion) + ".bundle";
                    }
                }
            }

            log(LogLevel::Info, LOG_CATEGORY_UPDATER, "Using JavaScript bundle");
            return baseURL + "unbound.js";
        }
    }

    log(LogLevel::Error, LOG_CATEGORY_UPDATER,
        "Failed to fetch manifest; falling back to JavaScript bundle");
    if (directURL)
    {
        return *directURL;
    }
    return baseURL + "unbound.js";
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

    std::string storedEtag = settings_.getString("loader.update.etag", "");
    std::string url        = downloadURL(updateURL, bytecodeVersion);

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
    if (fileExists(targetPath) && !forceUpdate && !storedEtag.empty())
    {
        headers["If-None-Match"] = storedEtag;
    }

    std::optional<DownloadResult> response =
        download_ ? download_(url, candidatePath, headers, kBundleDownloadPolicy) : std::nullopt;
    if (!response)
    {
        throw std::runtime_error("Bundle download failed");
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

    if (!writeTextFileAtomically(candidatePath + ".etag", response->etag))
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
}
}
