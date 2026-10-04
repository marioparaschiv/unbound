# Native plugin ABI

The native plugin system lets trusted JavaScript plugins use approved Objective-C runtime operations without shipping a plugin dylib. The loader contains the signed runtime primitives; the plugin supplies policy, state, rendering decisions, and lifecycle code.

The native layer is an ABI. Plugins consume it through the versioned JavaScript API exposed as `context.native`.

## Runtime boundary

The loader publishes a generic bridge as `globalThis.NativePlugin`. It contains only the ABI version, JavaScript API version, capability list, Objective-C operations, and raw FFI operations. Platform-wide helpers such as device information and notifications live under `globalThis.NativePlatform`.

Feature-specific native classes, caches, network clients, renderers, and hooks are not part of the loader surface. A plugin owns that behavior and uses the generic bridge to reach the app's existing Objective-C objects.

## Plugin scope

The addon manager validates the manifest before starting a plugin and creates a scoped context:

```ts
const context = native.createPluginContext('mention-avatars', [
	'native.objc.classes',
	'native.objc.invoke',
	'native.objc.ivars',
	'native.objc.associations',
	'native.objc.hooks',
]);
```

The scope gates each operation, owns hook tokens and association keys, and disposes all resources when the plugin stops, unloads, reloads, or fails during startup.

## Objective-C bridge

`objc.getClass`, `alloc`, `className`, `respondsTo`, `call`, `callSuper`, `invoke`, `invokeSuper`, `getIvar`, `setIvar`, `createAssociationKey`, `getAssociatedObject`, `setAssociatedObject`, `struct`, `array`, and `data` cover the supported runtime surface. The loader parses method encodings and rejects unsupported arguments or results before invoking a method.

Handles are opaque retained host objects. Hook arguments are borrowed until the callback returns. Values that escape a callback must be explicitly retained through the supported bridge operations. Every call runs inside an autorelease pool.

Hooks are registered by `(Class, SEL)`. One loader-owned dispatcher preserves the original implementation, calls handlers in registration order, and restores the implementation only if the dispatcher is still installed. Hook tokens are idempotent.

`call` uses the current runtime thread. `invoke` and `invokeSuper` accept an explicit `current` or `main` thread policy. Unsupported synchronous crossings fail with a structured error instead of blocking the runtime indefinitely.

## Raw FFI

`ffi.symbol` resolves symbols from already-loaded images. `ffi.call` accepts explicit non-variadic signatures containing supported scalar types, pointers, Objective-C object/class/selector pointers, and registered structs.

The v1 contract excludes arbitrary memory access, pointer dereference, arbitrary `dlopen`, variadic calls, unknown structs, vectors, unions, bitfields, and plugin-supplied native closures.

## Fabric surfaces

The `fabric` namespace lets a plugin register a React Native component and mount its real Fabric view inside an existing UIKit container. `mount` starts the surface with initial properties, `update` sends new properties, `setSize` supplies surface constraints, `setFrame` positions the view, `measure` returns the container frame, and `unmount` stops and removes it. All UIKit work is marshalled to the main thread and surface handles are scoped to the plugin.

The `native.fabric.mount` capability is required for every Fabric operation. A plugin should mount into the host view that owns the message layout, not create a window-level overlay.

## Mention avatars migration

Mention avatars are the first complete proof of the boundary. The plugin keeps message and member state, mention matching, role resolution, avatar URL caching, image conversion, attributed-string construction, attachment/run-delegate setup, reuse handling, and rerender scheduling in JavaScript.

The plugin uses generic class lookup, selector calls, ivar traversal, registered structs, data conversion, and hooks on message cells. It does not call feature-specific native methods because none exist in the loader anymore.

The migration is successful when the plugin can be stopped and restarted without leaked hooks, retained objects, stale associated values, or native feature state. The packaged loader must contain no mention-avatar symbols or strings.

## Safety and diagnostics

Capabilities are explicit and unknown names fail manifest validation. Diagnostics report bridge-version mismatches, missing capabilities, wrong-thread calls, unsupported encodings, symbol failures, hook failures, and handler exceptions. Failures are converted to structured JavaScript errors wherever possible.

The bridge is intended for approved trusted plugins. Capability declarations provide least-privilege scoping, but they are not a sandbox against a plugin that is already authorized to invoke native operations.

## Verification

Host tests cover encoding parsing, scalar/object/struct conversion, 64-bit integer handling, FFI signatures, symbol lookup, handle lifetime, association cleanup, hook chaining, and implementation restoration. Device acceptance on a real arm64 or arm64e Discord build covers runtime compatibility, thread behavior, launch stability, plugin restart, scrolling, cell reuse, and performance.
