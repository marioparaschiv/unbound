#pragma once

namespace loader {
// 1.1.0: the loader enforces a bundle manifest's `minLoaderVersion`, so loaders older than that
// refuse bundles they cannot check.
inline constexpr char kNativePluginApiVersion[] = "1.1.0";
inline constexpr char kNativePluginAbiVersion[] = "1.0.0";
}
