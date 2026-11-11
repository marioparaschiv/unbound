import type { NativePluginBridge, NativePluginCapability } from '@unbound-app/api/native';

/**
 * @description Checks that the loader offers every native capability a feature uses, since a missing bridge is a stand-in whose methods throw.
 * @param native The bridge from `context.native`.
 * @param capabilities The capabilities to check, usually `context.capabilities`.
 * @param feature The feature that needs them, named in the warning; `Plugin` when omitted.
 * @returns `true` when every capability is available, otherwise `false` after one warning naming the missing ones.
 */
export function ensureCapabilities(
	native: Pick<NativePluginBridge, 'capabilities'>,
	capabilities: readonly NativePluginCapability[],
	feature = 'Plugin',
): boolean {
	const missing = capabilities.filter((capability) => !native.capabilities.includes(capability));

	if (missing.length) {
		logger.warn(
			`${feature} skipped: native capabilities not available: ${missing.join(', ')}.`,
		);
	}

	return !missing.length;
}

export default ensureCapabilities;
