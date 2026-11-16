import { NATIVE_BRIDGE_PLATFORM_CAPABILITIES } from '@unbound-app/types/native';
import type { NativeBridge } from '@unbound-app/types';

import { createScopedNativeBridge } from '~/native/scope';
import { currentPlatform } from '~/native/platform';

const DEV_NATIVE_GLOBAL = '__unboundDevNative';
const DEV_NATIVE_OWNER = 'unbound.devtools';

let scope: ReturnType<typeof createScopedNativeBridge> | undefined;

function devNative(): NativeBridge {
	const platform = currentPlatform();

	scope ??= createScopedNativeBridge(
		platform ? NATIVE_BRIDGE_PLATFORM_CAPABILITIES[platform] : [],
		platform,
		undefined,
		DEV_NATIVE_OWNER,
	);

	return scope.bridge;
}

/**
 * @description Lets `ubd debug eval --native` reach a native bridge with every capability, created on first use and
 * kept for the debugger session so hooks and handles made in one eval outlive it.
 */
export function installDevNative(): void {
	Reflect.set(globalThis, DEV_NATIVE_GLOBAL, devNative);
}

/**
 * @description Removes the eval native bridge and releases every hook, handle and surface made through it.
 */
export function removeDevNative(): void {
	Reflect.deleteProperty(globalThis, DEV_NATIVE_GLOBAL);
	scope?.dispose();
	scope = undefined;
}

export default { installDevNative, removeDevNative };
