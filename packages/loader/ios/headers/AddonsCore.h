#pragma once

#include <memory>
#include <nlohmann/json.hpp>

#include "LoaderAddons.h"
#include "LoaderFontService.h"

loader::AddonState &UnboundAddonState();
// Opened on first use, migrating the old `font-states` setting; a change re-applies the fonts.
std::shared_ptr<loader::fonts::FontService> UnboundFonts();
const nlohmann::json                       &UnboundPlatformFonts();
nlohmann::json                              UnboundFontCatalog();
