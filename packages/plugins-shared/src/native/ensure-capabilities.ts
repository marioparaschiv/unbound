import type { NativePluginBridge, NativePluginCapability } from '@unbound-app/api/native';

/**
 * @description Checks that the loader offers every native capability a feature uses, since a missing bridge is a stand-in whose methods throw.
 * @param plugin The plugin's display name, or `Plugin: feature` for a single feature, used in the log line.
 * @param native The bridge from `context.native`.
 * @param capabilities The capabilities to check, usually `context.capabilities`.
 * @returns `true` when every capability is available, otherwise `false` after logging the missing ones.
 */
export function ensureCapabilities(
	plugin: string,
	native: Pick<NativePluginBridge, 'capabilities'>,
	capabilities: readonly NativePluginCapability[],
): boolean {
	const missing = capabilities.filter((capability) => !native.capabilities.includes(capability));

	if (!missing.length) {
		return true;
	}

	console.error(`[${plugin}] Skipped, native capabilities not available: ${missing.join(', ')}.`);

	return false;
}

export default ensureCapabilities;
