import type { Plugin, RollupCache } from 'rollup';
import { statSync } from 'node:fs';
import { rollup } from 'rollup';

import type { Globals } from './globals.ts';

export type LazyModuleBuild = {
	plugins: () => Plugin[];
	external: (id: string) => boolean;
	globals: Globals;
};

/** A deferred module's rendered source, and the modification time of every file it was built from. */
type Rendered = {
	files: Map<string, number>;
	source: string;
};

const virtualPrefix = '\0lazy-module:';
const namespaceName = '__unboundLazyModule';

/**
 * @description Generates a module whose exports load the wrapped bundle the first time one is used.
 * @param code The wrapped module, built as an IIFE assigned to `__unboundLazyModule`.
 * @param exportNames The wrapped module's export names.
 * @returns The generated module's source.
 */
export function lazyModuleSource(code: string, exportNames: string[]): string {
	const exports = exportNames.map((name) =>
		name === 'default'
			? 'export default binding("default");'
			: `export const ${name} = binding(${JSON.stringify(name)});`,
	);

	return [
		'let loaded;',
		`function load() { return (loaded ??= (function () { ${code}\nreturn ${namespaceName}; })()); }`,
		'function binding(name) {',
		'\treturn new Proxy(function () {}, {',
		'\t\tapply: (_target, self, args) => Reflect.apply(load()[name], self, args),',
		'\t\tconstruct: (_target, args) => Reflect.construct(load()[name], args),',
		'\t\tget: (_target, key) => Reflect.get(load()[name], key),',
		'\t\tset: (_target, key, value) => Reflect.set(load()[name], key, value),',
		'\t\thas: (_target, key) => Reflect.has(load()[name], key),',
		'\t});',
		'}',
		...exports,
	].join('\n');
}

/**
 * @description Builds the listed modules apart and evaluates each only when the plugin first uses one of its exports.
 * @param specifiers Import specifiers to defer, such as `highlight.js/lib/common`.
 * @param build How to build each deferred module.
 * @returns The rollup plugin.
 */
export function lazyModules(specifiers: string[], build: LazyModuleBuild): Plugin {
	const deferred = new Set(specifiers);
	// A watching build reuses this plugin: a deferred module whose files kept their times is not
	// rebuilt, and a changed one re-transforms only what changed.
	const caches = new Map<string, RollupCache>();
	const rendered = new Map<string, Rendered>();

	return {
		name: 'lazy-modules',
		async resolveId(source, importer, options) {
			if (!deferred.has(source)) return null;

			const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });

			return resolved && !resolved.external ? `${virtualPrefix}${resolved.id}` : null;
		},
		async load(id) {
			if (!id.startsWith(virtualPrefix)) return null;

			const previous = rendered.get(id);

			if (previous && isUnchanged(previous.files)) {
				for (const file of previous.files.keys()) {
					this.addWatchFile(file);
				}

				return previous.source;
			}

			const bundle = await rollup({
				input: id.slice(virtualPrefix.length),
				external: build.external,
				plugins: build.plugins(),
				cache: caches.get(id),
				onwarn: (warning) => this.warn(warning),
			});
			const {
				output: [chunk],
			} = await bundle.generate({
				format: 'iife',
				name: namespaceName,
				globals: build.globals,
				compact: true,
				exports: 'named',
			});

			for (const file of bundle.watchFiles) {
				this.addWatchFile(file);
			}

			await bundle.close();

			const source = lazyModuleSource(chunk.code, chunk.exports);

			if (bundle.cache) {
				caches.set(id, bundle.cache);
			}

			rendered.set(id, { files: stamp(bundle.watchFiles), source });

			return source;
		},
	};
}

function modifiedAt(file: string): number {
	try {
		return statSync(file).mtimeMs;
	} catch {
		// A virtual or deleted module has no time, so it never matches and forces a rebuild.
		return Number.NaN;
	}
}

function stamp(files: string[]): Map<string, number> {
	return new Map(files.map((file) => [file, modifiedAt(file)]));
}

function isUnchanged(files: Map<string, number>): boolean {
	return [...files].every(([file, time]) => modifiedAt(file) === time);
}

export default { lazyModuleSource, lazyModules };
