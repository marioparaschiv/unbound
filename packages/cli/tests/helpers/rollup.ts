import { rollup } from 'rollup';

import { unbound, type PluginConfigOptions } from '../../src/rollup/preset';

/**
 * @description Builds a plugin with the `unbound` preset, without Hermes bytecode, and returns its bundle.
 * @param pluginUrl The URL of the plugin's `rollup.config.mjs`.
 * @param options Preset options.
 * @param warnings Receives each build warning's message; without it, rollup prints them.
 * @returns The bundle's code.
 */
export async function buildBundle(
	pluginUrl: string,
	options: PluginConfigOptions = {},
	warnings?: string[],
): Promise<string> {
	const { output: outputOptions, ...config } = unbound(pluginUrl, {
		...options,
		bytecode: false,
	});
	const bundle = await rollup({
		...config,
		...(warnings ? { onwarn: (warning) => void warnings.push(warning.message) } : {}),
	});
	const { output } = await bundle.generate(
		Array.isArray(outputOptions) ? {} : (outputOptions ?? {}),
	);

	await bundle.close();

	return output[0].code;
}

export default buildBundle;
