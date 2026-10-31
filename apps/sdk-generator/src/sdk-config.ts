/**
 * Policy for the plugin SDK generator (`apps/sdk-generator`) that it cannot infer from the api
 * barrel's `export * as` specifiers: inlined libraries, surface roots and subpath escape hatches.
 */

type SubpathEntry = {
	name: string;
	source: string;
};

type SdkConfig = {
	/**
	 * Packages whose typings are flattened into the bundle rather than becoming peers. `react`,
	 * `react-native` and `@types/react` are deliberately absent: they stay external peers.
	 */
	inlinedLibraries: string[];
	/** The public-surface root, relative to the repo root. Every `export * as` here becomes a module. */
	barrelPath: string;
	/** The directory the generated `.d.ts` tree is written to, relative to the repo root. */
	outDir: string;
	/**
	 * Auto-derived nested subpaths to skip (by their full subpath name, e.g. `metro/common`). Use this
	 * to keep a sub-namespace ambient-only instead of publishing it as its own entry point.
	 */
	excludeSubpaths: string[];
	/**
	 * Extra subpath entries to emit beyond what barrel derivation finds. `source` is relative to the
	 * barrel's directory. Rarely needed - derivation covers every `export * as`.
	 */
	additionalSubpaths: SubpathEntry[];
};

export const config: SdkConfig = {
	inlinedLibraries: [
		'@unbound-app/types',
		'@unbound-app/discord-types',
		'@unbound-app/logger',
		'@unbound-app/utils',
		'possess',
	],
	barrelPath: 'packages/client/src/api/index.ts',
	outDir: 'packages/api/src',
	excludeSubpaths: [],
	additionalSubpaths: [],
};

export default config;
