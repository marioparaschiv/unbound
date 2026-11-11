#pragma once

#include <cstdint>
#include <functional>
#include <jsi/jsi.h>
#include <memory>
#include <nlohmann/json.hpp>
#include <string>

#include "LoaderAddons.h"
#include "LoaderFontService.h"
#include "LoaderTransport.h"

namespace loader {
// What `globalThis.UnboundNative` reads and does. Each member runs when the client calls its
// method; an empty getter reads as an empty array, or an empty object for the loader.
struct UnboundNativeProvider {
    std::function<nlohmann::json()> getLoader;
    std::function<nlohmann::json()> getPlugins;
    std::function<nlohmann::json()> getThemes;
    std::function<nlohmann::json()> getAppIcons;
    // Whether a newer bundle downloaded this launch and runs at the next restart.
    std::function<nlohmann::json()> hasStagedBundle;
    // Rereads the installed themes and reapplies the selected one; left out of the bridge when
    // empty. The platform sets it, as only it can recolour native views.
    std::function<void()>        rescanThemes;
    std::function<void()>        syncAppIcons;
    std::function<std::string()> buildIconIPA;
    std::function<bool(const std::string &name, const std::string &imagePath)>
        installHomeScreenIcon;
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

void installUnboundNative(facebook::jsi::Runtime &runtime, UnboundNativeProvider provider);
}
