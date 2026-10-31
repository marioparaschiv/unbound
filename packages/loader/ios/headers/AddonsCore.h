#pragma once

#include <nlohmann/json.hpp>

#include "LoaderAddons.h"

loader::AddonState   &AstralAddonState();
const nlohmann::json &AstralPlatformFonts();
nlohmann::json        AstralFontCatalog();
