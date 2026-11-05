#pragma once

#include <cstdint>
#include <functional>
#include <jsi/jsi.h>
#include <memory>
#include <nlohmann/json.hpp>
#include <string>

#include "LoaderAddons.h"
#include "LoaderFontService.h"
#include "LoaderUpdater.h"

namespace loader {
// What `globalThis.UnboundNative` reads and does. Each member runs when the client calls its
// method; an empty getter reads as an empty array, or an empty object for the loader.
struct UnboundNativeProvider {
    std::function<nlohmann::json()> getLoader;
    std::function<nlohmann::json()> getPlugins;
    std::function<nlohmann::json()> getThemes;
    // The Unbound app icons the installed app declares, as `{id, name, image}` objects; the
    // platform sets it, as only it can read the app's own icon declarations. Empty when unset.
    std::function<nlohmann::json()> getAppIcons;
    // Rereads the installed themes and reapplies the selected one; left out of the bridge when
    // empty. The platform sets it, as only it can recolour native views.
    std::function<void()> rescanThemes;
    // Installs the custom app icons the client saved in Unbound's folder and drops removed ones;
    // left out of the bridge when empty, which tells the client it cannot add icons. Returns
    // before the icons are installed; `getAppIcons` lists them once they are.
    std::function<void()> syncAppIcons;
    // Saves `url` to `path`, relative to Unbound's folder. Runs off the JS thread; throws what
    // failed.
    std::function<void(const std::string &url, const std::string &path)> downloadFile;
    // `UnboundNative.fonts`; left out of the bridge when empty.
    std::shared_ptr<fonts::FontService> fonts;
};

// Reads `addons` live at each call, so it must outlive every runtime the provider is installed in.
// `documents` is Unbound's folder, the only place `downloadFile` writes.
UnboundNativeProvider makeUnboundNativeProvider(const AddonState                   &addons,
                                                std::shared_ptr<fonts::FontService> fonts,
                                                std::string origin, uint32_t bytecodeVersion,
                                                std::string documents, FileDownloader download);

// Installs `globalThis.UnboundNative`.
void installUnboundNative(facebook::jsi::Runtime &runtime, UnboundNativeProvider provider);
}
