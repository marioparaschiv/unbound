#pragma once

#include <optional>
#include <string>

#include "LoaderUpdater.h"

loader::BundleUpdater     &UnboundBundleUpdater();
loader::UpdaterSettings    UnboundUpdaterSettings();
std::optional<std::string> UnboundUpdateURL();
