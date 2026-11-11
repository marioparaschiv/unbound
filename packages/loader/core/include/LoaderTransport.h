#pragma once

#include <functional>
#include <map>
#include <optional>
#include <string>

// How the loader reaches the network: each platform supplies a text fetch and a file download.
namespace loader {
struct DownloadResult {
    int         status = 0;
    std::string etag;
    // The response's Retry-After header, if any.
    std::string retryAfter;
};

struct DownloadPolicy {
    double connectTimeoutSeconds = 15.0;
    double readTimeoutSeconds    = 30.0;
    double totalTimeoutSeconds   = 35.0;
};

using TextFetcher =
    std::function<std::optional<std::string>(const std::string &url, double timeoutSeconds)>;
using FileDownloader = std::function<std::optional<DownloadResult>(
    const std::string &url, const std::string &destination,
    const std::map<std::string, std::string> &headers, const DownloadPolicy &policy)>;
}
