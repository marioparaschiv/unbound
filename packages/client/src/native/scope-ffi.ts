import type { LoaderNativeBridge, NativeFFIBridge, NativePointer } from '@unbound-app/types';

import type { ScopeGate, ScopeLifecycle } from '~/native/scope-gate';

type FFISource = NonNullable<LoaderNativeBridge['ffi']>;

type ScopedFFI = { bridge: NativeFFIBridge; dispose: () => void };

/**
 * @description Scopes the FFI bridge to a plugin: it gates each call by capability and, on dispose, restores the
 * plugin's rebinds, releases its callbacks and frees its memory, in that order.
 * @param source The loader's FFI bridge.
 * @param scopeBridgeMethod The plugin scope's gate for bridge methods.
 * @param lifecycle Whether the scope is disposed, which stops callbacks from running plugin code.
 * @returns The scoped bridge and its `dispose`.
 */
export function createScopedFFIBridge(
	source: FFISource,
	scopeBridgeMethod: ScopeGate['scopeBridgeMethod'],
	lifecycle: ScopeLifecycle,
): ScopedFFI {
	const ffiCallbacks = new Set<NativePointer>();
	const ffiAllocations = new Set<NativePointer>();
	const ffiRebinds = new Set<string>();
	const bridge: NativeFFIBridge = {
		symbol: scopeBridgeMethod(source, 'symbol', 'ffi.symbol'),
		call: scopeBridgeMethod(source, 'call', 'ffi.call'),
		alloc: (size) => {
			const pointer = scopeBridgeMethod(source, 'alloc', 'ffi.alloc')(size);

			ffiAllocations.add(pointer);

			return pointer;
		},
		free: (pointer) => {
			ffiAllocations.delete(pointer);

			return scopeBridgeMethod(source, 'free', 'ffi.free')(pointer);
		},
		read: scopeBridgeMethod(source, 'read', 'ffi.read'),
		write: scopeBridgeMethod(source, 'write', 'ffi.write'),
		callback: (signature, implementation) => {
			const pointer = scopeBridgeMethod(
				source,
				'callback',
				'ffi.callback',
			)(signature, (...args) => (lifecycle.disposed ? undefined : implementation(...args)));

			ffiCallbacks.add(pointer);

			return pointer;
		},
		releaseCallback: (pointer) => {
			ffiCallbacks.delete(pointer);

			return scopeBridgeMethod(source, 'releaseCallback', 'ffi.releaseCallback')(pointer);
		},
		rebind: (name, replacement) => {
			const rebinding = scopeBridgeMethod(source, 'rebind', 'ffi.rebind')(name, replacement);

			ffiRebinds.add(name);

			return rebinding;
		},
		restore: (name) => {
			ffiRebinds.delete(name);

			return scopeBridgeMethod(source, 'restore', 'ffi.restore')(name);
		},
	};

	return {
		bridge,
		dispose() {
			for (const name of ffiRebinds) source.restore?.(name);

			ffiRebinds.clear();

			for (const pointer of ffiCallbacks) source.releaseCallback?.(pointer);

			ffiCallbacks.clear();

			for (const pointer of ffiAllocations) source.free?.(pointer);

			ffiAllocations.clear();
		},
	};
}

export default { createScopedFFIBridge };
