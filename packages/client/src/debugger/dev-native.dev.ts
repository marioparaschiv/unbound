import { NATIVE_BRIDGE_PLATFORM_CAPABILITIES } from '@unbound-app/types/native';
import type { NativeBridge } from '@unbound-app/types';

import { createScopedNativeBridge } from '~/native/scope';
import { currentPlatform } from '~/native/platform';
import { getNativeBridge } from '~/native/bridge';

const DEV_NATIVE_GLOBAL = '__unboundDevNative';
const DEV_INSPECTOR_GLOBAL = '__unboundDevInspector';
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
 * @description Lets `ubd debug inspect` read Objective-C classes through the loader's inspector, and `ubd debug eval --native` reach a native bridge with every capability, created on first use and
 * kept for the debugger session so hooks and handles made in one eval outlive it.
 */
export function installDevNative(): void {
	Reflect.set(globalThis, DEV_NATIVE_GLOBAL, devNative);
	Reflect.set(globalThis, DEV_INSPECTOR_GLOBAL, () => getNativeBridge()?.objc);
}

/**
 * @description Removes the inspector and the eval native bridge, and releases every hook, handle and surface made through it.
 */
export function removeDevNative(): void {
	Reflect.deleteProperty(globalThis, DEV_NATIVE_GLOBAL);
	Reflect.deleteProperty(globalThis, DEV_INSPECTOR_GLOBAL);
	scope?.dispose();
	scope = undefined;
}

export default { installDevNative, removeDevNative };
