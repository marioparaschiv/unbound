#pragma once

#include <array>
#include <span>

#include <jsi/jsi.h>

namespace loader::native
{
    inline constexpr std::array<const char *, 15> kIOSNativePluginCapabilities = {
        "native.objc.classes",
        "native.objc.invoke",
        "native.objc.invokeAsync",
        "native.objc.batch",
        "native.objc.snapshot",
        "native.objc.ivars",
        "native.objc.associations",
        "native.objc.hooks",
        "native.ffi.symbols",
        "native.ffi.call",
        "native.fabric.mount",
        "native.fabric.async",
        "native.runtime.events",
        "native.debug.evaluations",
        "native.debug.environment",
    };

    inline constexpr std::array<const char *, 18> kAndroidNativePluginCapabilities = {
        "native.ui.lookup",
        "native.ui.layout",
        "native.ui.mount",
        "native.runtime.events",
        "native.java.classes",
        "native.java.invoke",
        "native.java.invokeAsync",
        "native.java.fields",
        "native.java.construct",
        "native.java.hooks",
        "native.java.batch",
        "native.java.associations",
        "native.debug.evaluations",
        "native.debug.environment",
        "native.fabric.mount",
        "native.fabric.async",
        "native.ffi.symbols",
        "native.ffi.call",
    };

    facebook::jsi::Object makeNativePluginRoot(facebook::jsi::Runtime &runtime,
                                               std::span<const char *const> capabilities);
}
