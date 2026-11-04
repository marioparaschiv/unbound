#pragma once

#include <cstdint>
#include <functional>
#include <jsi/jsi.h>
#include <nlohmann/json.hpp>
#include <string>

#include "LoaderAddons.h"

namespace loader {
// The launch data `globalThis.UnboundNative` reads. Each member runs when the client calls its
// getter; an empty member reads as an empty array, or an empty object for the loader.
struct UnboundNativeProvider {
    std::function<nlohmann::json()> loader;
    std::function<nlohmann::json()> plugins;
    std::function<nlohmann::json()> themes;
    std::function<nlohmann::json()> fonts;
    std::function<nlohmann::json()> availableFonts;
};

// Reads `addons` live at each call, so it must outlive every runtime the provider is installed in.
UnboundNativeProvider makeUnboundNativeProvider(const AddonState               &addons,
                                                std::function<nlohmann::json()> availableFonts,
                                                std::string origin, uint32_t bytecodeVersion);

// Installs `globalThis.UnboundNative`; getAvailableFonts calls its provider once per runtime.
void installUnboundNative(facebook::jsi::Runtime &runtime, UnboundNativeProvider provider);
}
