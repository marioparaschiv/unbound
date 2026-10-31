import type { AddonManifest } from '@unbound-app/types/addons';
import type { PluginContext } from '@unbound-app/types';

import { validateNativePluginRequirements } from '~/native/capabilities';
import { resolveManifestCapabilities } from '~/addons/manifest';
import type { AddonAttribution } from '~/addons/crash-guard';
import { createScopedNativePlugin } from '~/native/scope';
import { currentPlatform } from '~/native/platform';

const stoppers = new WeakMap<object, () => void>();

/**
 * @description Lets the native calls a plugin makes from now on, during its `stop`, finish after its context is disposed.
 * @param context The context of the plugin about to stop.
 */
export function beginNativeStop(context: PluginContext | undefined): void {
	if (context) {
		stoppers.get(context.native)?.();
	}
}

/**
 * @description Builds a plugin's context, with a native bridge scoped to its declared capabilities.
 * @param manifest The plugin's manifest.
 * @param attribute Marks the plugin as active in the loader's crash attribution while its native calls run.
 * @returns The plugin context; call its `dispose` to release the plugin's native resources.
 */
export function createPluginContext(
	manifest: AddonManifest,
	attribute?: AddonAttribution,
): PluginContext {
	const platform = currentPlatform();
	const capabilities = resolveManifestCapabilities(manifest, platform);

	validateNativePluginRequirements(capabilities, manifest.minNativePluginApi);
	const scoped = createScopedNativePlugin(capabilities, platform, attribute);

	stoppers.set(scoped.bridge, scoped.beginStop);

	return {
		manifest,
		id: manifest.id,
		platform,
		capabilities,
		native: scoped.bridge,
		dispose: scoped.dispose,
	};
}

export default { beginNativeStop, createPluginContext };
