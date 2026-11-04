// `@unbound-app/rollup-plugin-hermes` ships no types; these declare only what the build calls.
declare module '@unbound-app/rollup-plugin-hermes/dist/manifest.js' {
	import type { PluginContext } from 'rolldown';

	type HermesManifest = { latest: number[] };

	const hermesManifest: {
		fetchManifest(context: PluginContext): Promise<HermesManifest>;
	};

	export default hermesManifest;
}

declare module '@unbound-app/rollup-plugin-hermes' {
	import type { NormalizedOutputOptions, OutputBundle, PluginContext } from 'rolldown';

	export type HermesOptions = { versions: number; flags: string[] };

	export type HermesPlugin = {
		generateBundle(
			this: PluginContext,
			options: NormalizedOutputOptions,
			bundle: OutputBundle,
			isWrite: boolean,
		): Promise<void>;
		buildEnd(this: PluginContext): Promise<void>;
	};

	export default function hermes(options: HermesOptions): HermesPlugin;
}
