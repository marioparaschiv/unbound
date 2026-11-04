#pragma once

#include <optional>
#include <string>

#include "LoaderUpdater.h"

loader::BundleUpdater     &UnboundBundleUpdater();
loader::UpdaterSettings    UnboundUpdaterSettings();
std::optional<std::string> UnboundUpdateURL();
std::optional<loader::DownloadResult>
UnboundDownload(const std::string &url, const std::string &destination,
                const std::map<std::string, std::string> &headers,
                const loader::DownloadPolicy             &policy);
