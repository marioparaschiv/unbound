import type { NativePlatformBridge, NativePluginPlatform } from '@unbound-app/types';
import { NATIVE_PLUGIN_PLATFORMS } from '@unbound-app/types/native';

import { NativePluginUnsupportedPlatformError } from '~/native/errors';

/** One Platform handler per platform an addon runs on. */
export type PlatformHandlers<Handler> = Partial<Record<NativePluginPlatform, Handler>>;

export const NativePlatform: NativePlatformBridge | undefined = globalThis.NativePlatform;

/**
 * @description Reads the host platform the loader reports.
 * @returns The platform, which an unrecognised host may report as something other than `ios` or `android`.
 */
export function currentPlatform(): NativePluginPlatform | undefined {
	const platform = globalThis.NativePlatform;

	return platform?.device?.platform ?? platform?.platform;
}

/**
 * @description Selects the Platform handler for the host platform, so an addon branches on the platform in one place.
 * @template Handler What each platform's handler provides.
 * @param handlers The handler for each platform the addon runs on.
 * @returns The host platform's handler.
 */
export function definePlatform<Handler>(handlers: PlatformHandlers<Handler>): Handler {
	const platform = currentPlatform();
	const handler = platform ? handlers[platform] : undefined;

	if (handler === undefined) {
		const supported = NATIVE_PLUGIN_PLATFORMS.filter((name) => handlers[name] !== undefined);

		throw new NativePluginUnsupportedPlatformError(supported, String(platform));
	}

	return handler;
}

export default { NativePlatform, currentPlatform, definePlatform };
