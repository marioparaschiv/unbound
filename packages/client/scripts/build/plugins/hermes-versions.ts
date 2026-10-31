import type { NormalizedOutputOptions, OutputBundle, Plugin, PluginContext } from 'rolldown';
import hermesManifest from '@unbound-app/rollup-plugin-hermes/dist/manifest.js';
import hermes from '@unbound-app/rollup-plugin-hermes';

import { hermescCount } from '../sync-hermes';

type HermesPlugin = {
	generateBundle(
		this: PluginContext,
		options: NormalizedOutputOptions,
		bundle: OutputBundle,
		isWrite: boolean,
	): Promise<void>;
	buildEnd(this: PluginContext): Promise<void>;
};

/**
 * @description Compiles the bundle with hermesc for every bytecode version the client ships, resolving
 * however many of hermesc's newest versions that takes, so a newly published hermesc never displaces one.
 * @param versions The bytecode versions the client ships.
 * @param flags Extra hermesc flags.
 * @returns The rolldown plugin.
 */
export default function hermesVersions(versions: number[], flags: string[]): Plugin {
	let compiler: HermesPlugin | undefined;

	return {
		name: 'hermes-versions',
		async generateBundle(options, bundle, isWrite) {
			const { latest } = await hermesManifest.fetchManifest(this);

			compiler ??= hermes({
				versions: hermescCount(latest, versions),
				flags,
			}) as HermesPlugin;
			await compiler.generateBundle.call(this, options, bundle, isWrite);
		},
		async buildEnd() {
			await compiler?.buildEnd.call(this);
		},
	};
}
