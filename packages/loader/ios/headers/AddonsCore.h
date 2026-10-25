#pragma once

#include "LoaderAddons.h"

#include <nlohmann/json.hpp>

loader::AddonState &UnboundAddonState();
const nlohmann::json &UnboundPlatformFonts();
nlohmann::json UnboundFontCatalog();
