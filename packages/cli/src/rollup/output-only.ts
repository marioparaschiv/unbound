import type { Plugin } from 'rollup';

/** The `api` flag on a plugin that only wraps, minifies or compiles the chunk, so `ubd check` renders without it. */
export const OUTPUT_ONLY = 'unboundOutputOnly';

/**
 * @description Marks a plugin as output-only: `ubd check` leaves it out when it renders the chunk for the plugins that check it.
 * @param plugin The plugin.
 * @returns A copy carrying the flag in its `api`.
 */
export function outputOnly(plugin: Plugin): Plugin {
	return { ...plugin, api: { ...plugin.api, [OUTPUT_ONLY]: true } };
}

export default outputOnly;
