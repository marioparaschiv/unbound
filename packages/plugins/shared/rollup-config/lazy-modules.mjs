import { rollup } from 'rollup';

const virtualPrefix = '\0lazy-module:';
const namespaceName = '__unboundLazyModule';

/**
 * Generates a module whose exports load the wrapped bundle the first time one is used.
 * @param {string} code The wrapped module, built as an IIFE assigned to `__unboundLazyModule`.
 * @param {string[]} exportNames The wrapped module's export names.
 */
export function lazyModuleSource(code, exportNames) {
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
 * Builds the listed modules apart and evaluates each only when the plugin first uses one of its exports.
 * @param {string[]} specifiers Import specifiers to defer, such as `highlight.js/lib/common`.
 * @param {{ plugins: () => import('rollup').Plugin[], external: (id: string) => boolean, globals: (id: string) => string | undefined }} build How to build each deferred module.
 */
export function lazyModules(specifiers, build) {
	const deferred = new Set(specifiers);

	return {
		name: 'lazy-modules',
		async resolveId(source, importer, options) {
			if (!deferred.has(source)) return null;

			const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });

			return resolved && !resolved.external ? `${virtualPrefix}${resolved.id}` : null;
		},
		async load(id) {
			if (!id.startsWith(virtualPrefix)) return null;

			const bundle = await rollup({
				input: id.slice(virtualPrefix.length),
				external: build.external,
				plugins: build.plugins(),
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

			for (const file of bundle.watchFiles) this.addWatchFile(file);
			await bundle.close();

			return lazyModuleSource(chunk.code, chunk.exports);
		},
	};
}
