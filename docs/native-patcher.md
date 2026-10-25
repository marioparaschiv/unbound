# Native plugin ABI

The native plugin system lets trusted JavaScript plugins run approved Objective-C runtime operations without shipping a plugin dylib. The loader contains the signed runtime primitives. The plugin supplies policy, state, rendering decisions, and lifecycle code.

The native layer is an ABI. Plugins use it through the versioned JavaScript API exposed as `context.native`.

## Runtime boundary

The loader publishes a generic bridge as `globalThis.NativePlugin`. It contains only:

- the ABI version and the JavaScript API version
- the capability list
- Objective-C operations
- raw FFI operations

Platform-wide helpers, such as device information and notifications, live under `globalThis.NativePlatform`.

The loader surface does not include feature-specific native classes, caches, network clients, renderers, or hooks. A plugin owns that behavior and uses the generic bridge to reach the app's existing Objective-C objects.

## Plugin scope

The addon manager validates the manifest before starting a plugin, then creates a scoped context:

```ts
const context = native.createPluginContext('mention-avatars', [
	'native.objc.classes',
	'native.objc.invoke',
	'native.objc.ivars',
	'native.objc.associations',
	'native.objc.hooks',
]);
```

The scope gates each operation and owns the plugin's hook tokens and association keys. It disposes all of the plugin's resources when the plugin stops, unloads, reloads, or fails during startup.

## Objective-C bridge

These operations make up the supported runtime surface:

- Classes and objects: `objc.getClass`, `alloc`, `className`, `respondsTo`
- Method calls: `call`, `callSuper`, `invoke`, `invokeSuper`
- Instance variables: `getIvar`, `setIvar`
- Associated objects: `createAssociationKey`, `getAssociatedObject`, `setAssociatedObject`
- Value conversion: `struct`, `array`, `data`

The loader parses method encodings and rejects unsupported arguments or results before it invokes a method.

Handles are opaque, retained host objects. Hook arguments are borrowed until the callback returns. A value that escapes a callback must be retained explicitly through the supported bridge operations. Every call runs inside an autorelease pool.

Hooks are registered per `(Class, SEL)` pair. A single loader-owned dispatcher preserves the original implementation and calls handlers in registration order. It restores the original implementation only if the dispatcher is still installed. Hook tokens are idempotent.

A `cacheOnly` hook can supply an exact return value with `setReturnValue(self, args, value)`. For a method returning `CGSize`, `setSizeHeightFloor(self, args, floor)` instead raises each fresh result of the original method to at least a finite 0–4096-point height without invoking JavaScript in the hook. `removeSizeHeightFloor(self, args)` removes that minimum. Both operations match the target instance and the method's arguments; removing the hook or disposing its plugin scope clears the cached values and minimums. This is useful when asynchronous content changes the base size after a plugin has reserved space.

`call` uses the current runtime thread. `invoke` and `invokeSuper` accept an explicit `current` or `main` thread policy. A synchronous `invokeSuper` call cannot cross to the main thread. Existing synchronous `invoke` calls can still block while crossing to the main thread; new UI work should declare `native.objc.invokeAsync` and use `invokeAsync(handle, selector, args)` or `invokeSuperAsync(handle, currentClass, selector, args)` instead. Both return cancellable promises, run the Objective-C method on the main thread, and convert the result back on the JavaScript runtime thread. Stopping the plugin cancels its pending invocations. The bridge API and ABI version strings remain `1.0.0`; availability is negotiated through the capability.

`objc.batch(steps)` uses the separate `native.objc.batch` capability for dependent main-thread operations. Each step names a target handle, selector, and argument array. A later step can use `{ $nativeBatchResult: index }` as its target or an argument to refer to an earlier result. The bridge limits a batch to 64 steps, each with at most 16 arguments and a 256-character selector. It converts JavaScript inputs before dispatch, executes the sequence in one main-thread operation, and converts results on the runtime executor. The returned promise is cancellable and belongs to the plugin scope. A failed step rejects the batch; earlier side effects are not rolled back. Synchronous hooks and scrolling callbacks must not wait for a batch result. They should use cached decisions, schedule work, and leave the original UI in place until a valid result arrives.

`objc.snapshot(root, options)` uses the separate `native.objc.snapshot` capability to inspect a `UIView` subtree in one asynchronous main-thread pass. It returns nodes in breadth-first order with retained view handles, parent indices, class names, frames, label text, and visibility. The default limits are eight levels and 100 nodes; requests above 12 levels or 256 nodes are clamped to those maximums, and non-integer limits are rejected. A snapshot is only a point-in-time view: plugins must discard results after cell reuse, channel changes, or scope disposal, and must not retain whole snapshots in long-lived caches. The returned promise is cancellable. Plugins should filter for relevant nodes and apply any UI changes through asynchronous calls or batches.

`objc.findViews(root, className, options)` shares the snapshot capability and performs a bounded breadth-first class-name search on the main thread. It returns only matching retained view handles rather than materializing every traversed node. By default it visits at most 512 views to depth 24 and returns at most 64 matches; larger requests are clamped to 2,048 visits, depth 40, and 256 matches. `attachedOnly` restricts matches to views in a window, and `stopAtMatch` skips descendants of matched views. A plugin must still verify its lifecycle and cell identity after awaiting the result.

## Raw FFI

`ffi.symbol` resolves symbols from already-loaded images. `ffi.call` accepts only executable pointers returned by `ffi.symbol`.

`ffi.call` takes an explicit, non-variadic signature. A signature can contain:

- supported scalar types
- pointers
- Objective-C object, class, and selector pointers
- registered structs

The v1 contract excludes:

- arbitrary memory access and pointer dereference
- arbitrary `dlopen`
- variadic calls
- unknown structs, vectors, unions, and bitfields
- plugin-supplied native closures

## Fabric surfaces

The `fabric` namespace lets a plugin register a React Native component and mount its real Fabric view inside an existing UIKit container.

- `mount` starts the surface with initial properties.
- `update` sends new properties.
- `setSize` supplies surface constraints.
- `setFrame` positions the view.
- `measure` returns the container frame.
- `unmount` stops the surface and removes it.

All UIKit work is marshalled to the main thread, and surface handles are scoped to the plugin.

The `native.fabric.mount` capability gates the synchronous operations and is only offered on iOS. The `native.fabric.async` capability gates `mountAsync`, `updateAsync`, `setSizeAsync`, `setFrameAsync`, `measureAsync`, and `unmountAsync` on both platforms. These return cancellable promises; queued main-thread work is skipped if the plugin stops or the runtime is replaced. A plugin should mount into the host view that owns the message layout, not create a window-level overlay.

## Mention avatars migration

Mention avatars are the first feature built entirely on this boundary. The plugin keeps all of the following in JavaScript:

- message and member state
- mention matching and role resolution
- avatar URL caching and image conversion
- attributed-string construction and attachment/run-delegate setup
- reuse handling and rerender scheduling

The plugin uses generic class lookup, selector calls, ivar traversal, registered structs, data conversion, and hooks on message cells. It does not call feature-specific native methods, because the loader no longer contains any.

The migration is successful when the plugin can be stopped and restarted without leaving leaked hooks, retained objects, stale associated values, or native feature state behind. The packaged loader must contain no mention-avatar symbols or strings.

## Safety and diagnostics

Capabilities are explicit. An unknown capability name fails manifest validation.

Diagnostics report:

- version and capability problems: bridge-version mismatches, missing capabilities
- call problems: wrong-thread calls, unsupported encodings, symbol failures
- hook problems: hook failures, handler exceptions

Wherever possible, failures are converted to structured JavaScript errors.

The bridge is intended for approved, trusted plugins. Capability declarations provide least-privilege scoping, but they are not a sandbox. They do not restrict a plugin that is already authorized to invoke native operations.

## Verification

Host tests cover:

- encoding parsing
- scalar, object, and struct conversion
- 64-bit integer handling
- FFI signatures and symbol lookup
- handle lifetime and association cleanup
- hook chaining and implementation restoration

Device acceptance testing on a real arm64 or arm64e Discord build covers:

- runtime compatibility and thread behavior
- launch stability and plugin restart
- scrolling, cell reuse, and performance
