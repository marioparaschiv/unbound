import type { NativePluginBridge, NativePluginCapability } from '@unbound-app/api/native';
import { ensurePresent } from '@unbound-plugins/shared/lifecycle/features';

/**
 * @description Checks that the loader offers every native capability a feature uses, since a missing bridge is a stand-in whose methods throw.
 * @param native The bridge from `context.native`.
 * @param capabilities The capabilities to check, usually `context.capabilities`.
 * @param feature The feature that needs them, when not the whole plugin, named in the log line.
 * @returns `true` when every capability is available, otherwise `false` after logging the missing ones.
 */
export function ensureCapabilities(
	native: Pick<NativePluginBridge, 'capabilities'>,
	capabilities: readonly NativePluginCapability[],
	feature?: string,
): boolean {
	const missing = capabilities.filter((capability) => !native.capabilities.includes(capability));

	return ensurePresent(missing, 'native capabilities not available', feature);
}

export default ensureCapabilities;
