#pragma once

#include <memory>
#include <nlohmann/json.hpp>

#include "Loader.h"
#include "LoaderAddons.h"
#include "LoaderFontService.h"

// The loader, created and started on first use. Nothing its start reaches may call it again, as
// that would wait on itself.
std::shared_ptr<loader::Loader>             UnboundLoader();
loader::AddonState                         &UnboundAddonState();
std::shared_ptr<loader::fonts::FontService> UnboundFonts();
// The fonts installed on the device and in Discord, as catalog entries.
nlohmann::json UnboundPlatformFontEntries();
nlohmann::json UnboundFontCatalog();
