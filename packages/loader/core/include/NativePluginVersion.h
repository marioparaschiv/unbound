#pragma once

namespace loader {
// 1.1.0: the loader enforces a bundle manifest's `minLoaderVersion`, so loaders older than that
// refuse bundles they cannot check.
// 1.2.0: `fabric.batchAsync` applies Fabric mutations together on the next display frame.
inline constexpr char kNativePluginApiVersion[] = "1.2.0";
inline constexpr char kNativePluginAbiVersion[] = "1.0.0";
}
