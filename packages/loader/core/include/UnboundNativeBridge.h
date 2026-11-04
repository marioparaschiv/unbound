#pragma once

#include <cstdint>
#include <functional>
#include <jsi/jsi.h>
#include <nlohmann/json.hpp>
#include <string>

#include "LoaderAddons.h"
#include "LoaderUpdater.h"

namespace loader {
// What `globalThis.UnboundNative` reads and does. Each member runs when the client calls its
// method; an empty getter reads as an empty array, or an empty object for the loader.
struct UnboundNativeProvider {
    std::function<nlohmann::json()> getLoader;
    std::function<nlohmann::json()> getPlugins;
    std::function<nlohmann::json()> getThemes;
    std::function<nlohmann::json()> getFonts;
    std::function<nlohmann::json()> getAvailableFonts;
    // Saves `url` to `path`, relative to Unbound's folder. Runs off the JS thread; throws what
    // failed.
    std::function<void(const std::string &url, const std::string &path)> downloadFile;
};

// Reads `addons` live at each call, so it must outlive every runtime the provider is installed in.
// `documents` is Unbound's folder, the only place `downloadFile` writes.
UnboundNativeProvider makeUnboundNativeProvider(const AddonState               &addons,
                                                std::function<nlohmann::json()> availableFonts,
                                                std::string origin, uint32_t bytecodeVersion,
                                                std::string documents, FileDownloader download);

// Installs `globalThis.UnboundNative`; getAvailableFonts calls its provider once per runtime.
void installUnboundNative(facebook::jsi::Runtime &runtime, UnboundNativeProvider provider);
}
