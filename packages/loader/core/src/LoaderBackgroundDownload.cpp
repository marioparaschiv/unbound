#include "LoaderBackgroundDownload.h"

#include <filesystem>
#include <system_error>

#include "LoaderFiles.h"
#include "LoaderLog.h"

namespace loader {
namespace {
    void discardBackgroundDownload(const std::string &destination)
    {
        removeFile(destination + kBackgroundDownloadSuffix);
        removeFile(destination + kBackgroundDownloadURLSuffix);
    }

    bool moveFile(const std::string &source, const std::string &target)
    {
        std::error_code error;
        std::filesystem::rename(source, target, error);
        if (!error)
        {
            return true;
        }
        return copyFile(source, target) && removeFile(source);
    }
}

std::optional<DownloadResult> adoptBackgroundDownload(const std::string &url,
                                                      const std::string &destination)
{
    const std::string finished = destination + kBackgroundDownloadSuffix;
    if (!fileExists(finished))
    {
        return std::nullopt;
    }
    if (readTextFile(destination + kBackgroundDownloadURLSuffix) != url)
    {
        discardBackgroundDownload(destination);
        return std::nullopt;
    }
    removeFile(destination);
    if (!moveFile(finished, destination))
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            "Failed to adopt the background download of " + url);
        discardBackgroundDownload(destination);
        return std::nullopt;
    }
    removeFile(destination + kBackgroundDownloadURLSuffix);
    log(LogLevel::Info, LOG_CATEGORY_UPDATER, "Adopted the background download of " + url);
    DownloadResult result;
    result.status = 200;
    return result;
}

bool finishBackgroundDownload(const std::string &url, const std::string &destination,
                              const std::string &downloadedPath)
{
    discardBackgroundDownload(destination);
    if (!writeTextFileAtomically(destination + kBackgroundDownloadURLSuffix, url) ||
        !moveFile(downloadedPath, destination + kBackgroundDownloadSuffix))
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            "Failed to keep the background download of " + url);
        discardBackgroundDownload(destination);
        return false;
    }
    log(LogLevel::Info, LOG_CATEGORY_UPDATER, "Finished the background download of " + url);
    return true;
}

FileDownloader withBackgroundHandoff(FileDownloader foreground, BackgroundDownloader background)
{
    return [foreground = std::move(foreground), background = std::move(background)](
               const std::string &url, const std::string &destination,
               const std::map<std::string, std::string> &headers,
               const DownloadPolicy                     &policy) -> std::optional<DownloadResult> {
        if (background.collect)
        {
            background.collect(destination);
        }
        if (std::optional<DownloadResult> adopted = adoptBackgroundDownload(url, destination))
        {
            return adopted;
        }
        std::optional<DownloadResult> result =
            foreground ? foreground(url, destination, headers, policy) : std::nullopt;
        if (!result && background.start)
        {
            log(LogLevel::Info, LOG_CATEGORY_UPDATER,
                "Continuing the download of " + url + " in the background");
            background.start(url, destination, headers);
        }
        return result;
    };
}
}
