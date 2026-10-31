import type { NativePlatformBridge, NativePluginPlatform } from '@unbound-app/types';

export const NativePlatform: NativePlatformBridge | undefined = globalThis.NativePlatform;

/**
 * @description Reads the host platform the loader reports.
 * @returns The platform, which an unrecognised host may report as something other than `ios` or `android`.
 */
export function currentPlatform(): NativePluginPlatform | undefined {
	const platform = globalThis.NativePlatform;

	return platform?.device?.platform ?? platform?.platform;
}

export default { NativePlatform, currentPlatform };
