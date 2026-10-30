#pragma once

#include <optional>
#include <string>

#include "LoaderUpdater.h"

loader::BundleUpdater     &AstralBundleUpdater();
loader::UpdaterSettings    AstralUpdaterSettings();
std::optional<std::string> AstralUpdateURL();
