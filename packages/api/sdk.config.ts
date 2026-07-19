/**
 * Configuration for the plugin SDK generator (`apps/sdk-generator`).
 *
 * The generator derives the module surface by parsing the api barrel's `export * as <name>`
 * specifiers (recursively, for folder modules), so adding a public module never touches the
 * generator - you export it from the barrel and regenerate. The values here are the policy the
 * generator cannot infer: which libraries to inline, where the surface roots are, and the escape
 * hatches for the auto-derived subpaths.
 */

type SubpathEntry = {
	name: string;
	source: string;
};

type SdkConfig = {
	/**
	 * Package names whose typings are flattened into the bundle instead of kept as external imports.
	 * These never become peer dependencies - consumers ship no runtime, so they only need to resolve
	 * as types. `react`, `react-native`, and `@types/react` are deliberately absent: they stay
	 * external and are declared as peers.
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
		'@unbound-app/logger',
		'@unbound-app/utils',
		'tseep',
		'possess',
	],
	barrelPath: 'packages/client/src/api/index.ts',
	outDir: 'packages/api/src',
	excludeSubpaths: [],
	additionalSubpaths: [],
};

export default config;
