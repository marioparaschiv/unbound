#pragma once

#include <nlohmann/json.hpp>

#include "LoaderAddons.h"

loader::AddonState   &UnboundAddonState();
const nlohmann::json &UnboundPlatformFonts();
nlohmann::json        UnboundFontCatalog();
