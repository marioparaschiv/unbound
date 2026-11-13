#pragma once

#include <functional>
#include <map>
#include <optional>
#include <string>

#include "LoaderTransport.h"

namespace loader {
inline const std::string kBackgroundDownloadSuffix    = ".background";
inline const std::string kBackgroundDownloadURLSuffix = ".background.url";

using BackgroundDownloadStarter =
    std::function<void(const std::string &url, const std::string &destination,
                       const std::map<std::string, std::string> &headers)>;

using BackgroundDownloadCollector = std::function<void(const std::string &destination)>;

struct BackgroundDownloader {
    BackgroundDownloadCollector collect;
    BackgroundDownloadStarter   start;
};

std::optional<DownloadResult> adoptBackgroundDownload(const std::string &url,
                                                      const std::string &destination);
bool           finishBackgroundDownload(const std::string &url, const std::string &destination,
                                        const std::string &downloadedPath);
FileDownloader withBackgroundHandoff(FileDownloader foreground, BackgroundDownloader background);
}
