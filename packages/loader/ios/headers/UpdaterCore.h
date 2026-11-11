#pragma once

#include <map>
#include <optional>
#include <string>

#include "LoaderUpdater.h"

// iOS's transport for the loader: manifests, bundle and font downloads, and dev server probes.
std::optional<std::string> UnboundFetchText(const std::string &url, double timeout);
std::optional<loader::DownloadResult>
UnboundDownload(const std::string &url, const std::string &destination,
                const std::map<std::string, std::string> &headers,
                const loader::DownloadPolicy             &policy);
bool UnboundIsServing(const std::string &url, double timeout);
