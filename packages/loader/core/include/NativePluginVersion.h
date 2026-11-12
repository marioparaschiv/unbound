#pragma once

namespace loader {
// 1.1.0: the loader enforces a bundle manifest's `minLoaderVersion`, so loaders older than that
// refuse bundles they cannot check.
// 1.2.0: `fabric.batchAsync` applies Fabric mutations together on the next display frame.
// 1.3.0: UI-scope Java hooks rewrite their arguments.
// Raising the API needs a loader release that ships it and a client `minLoaderVersion` naming that
// release; `nativeBridgeAPILoader` in tools/native_bridge_version_test.go records the pair.
inline constexpr char kNativePluginApiVersion[] = "1.4.0";
inline constexpr char kNativePluginAbiVersion[] = "1.0.0";
}
