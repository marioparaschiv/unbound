import { parse, Type } from '@unbound-app/contracts/schema';
import { writeFile } from 'node:fs/promises';
import { transformSync } from '@swc/core';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'rolldown';

const WRAPPER_HEAD = '(() => {\n';

/** The build's `postBanner`, which keeps `global` on the global object. */
export const GLOBAL_BANNER = 'var global = globalThis;\n';

// Checks the `env` keys this plugin reads and passes any other `env` key through to swc.
const swcrcSchema = Type.Object({
	env: Type.Optional(
		Type.Object(
			{
				targets: Type.Optional(Type.String()),
				include: Type.Optional(Type.Array(Type.String())),
				exclude: Type.Optional(Type.Array(Type.String())),
			},
			{ additionalProperties: true },
		),
	),
});

const sourceMapSchema = Type.Object({ mappings: Type.String() }, { additionalProperties: true });

export type Lowered = {
	code: string;
	map?: string;
};

/** Where lowered code runs: compiled by our hermesc, or compiled from source by Discord's Hermes. */
export type LowerTarget = 'bytecode' | 'source';

// Our hermesc compiles these natively with `HERMESC_FEATURE_FLAGS`; Discord's Hermes compiles source without
// those flags, so code it compiles from source keeps them lowered.
const FLAGGED_TRANSFORMS = ['transform-block-scoping', 'transform-async-generator-functions'];

/** The hermesc flags that turn on the language features `FLAGGED_TRANSFORMS` otherwise lowers. */
export const HERMESC_FEATURE_FLAGS = ['-Xes6-block-scoping', '-Xasync-generators'];

function readEnv(root: string, target: LowerTarget) {
	const { env } = parse(swcrcSchema, JSON.parse(readFileSync(join(root, '.swcrc'), 'utf8')));

	if (target === 'source' || !env) {
		return env;
	}

	return {
		...env,
		include: env.include?.filter((name) => !FLAGGED_TRANSFORMS.includes(name)),
		exclude: [...(env.exclude ?? []), ...FLAGGED_TRANSFORMS],
	};
}

/**
 * @description Lowers bundled code to the `.swcrc` env targets for Hermes, and wraps it so its helpers stay scoped.
 * @param root The package root holding the `.swcrc` whose `env` is applied.
 * @param code The bundled code to lower.
 * @param sourceMaps Whether to also return a source map from the wrapped code back to `code`.
 * @param target `bytecode` leaves what our hermesc compiles natively; `source` lowers it for Discord's Hermes.
 * @returns The lowered code wrapped in an arrow function, keeping swc's helpers out of Discord's globals, and its map when asked for.
 */
export function lower(
	root: string,
	code: string,
	sourceMaps: boolean = false,
	target: LowerTarget = 'source',
): Lowered {
	const lowered = transformSync(code, {
		swcrc: false,
		configFile: false,
		sourceMaps,
		jsc: { parser: { syntax: 'ecmascript' } },
		env: readEnv(root, target),
	});
	const wrapped = `${WRAPPER_HEAD}${lowered.code}\n})();`;

	if (!lowered.map) {
		return { code: wrapped };
	}

	const map = parse(sourceMapSchema, JSON.parse(lowered.map));
	// Each line the wrapper adds above the lowered code is one empty mappings line.
	const headLines = ';'.repeat(WRAPPER_HEAD.split('\n').length - 1);

	return { code: wrapped, map: JSON.stringify({ ...map, mappings: headLines + map.mappings }) };
}

/**
 * @description Lowers each rendered chunk after tree-shaking and before minification, so dependencies stay tree-shakeable.
 * @param root The package root holding the `.swcrc` whose `env` is applied.
 * @returns A rolldown plugin down-levelling every rendered chunk.
 */
export default function downlevel(root: string): Plugin {
	return {
		name: 'downlevel',
		renderChunk(code, _chunk, options) {
			return lower(root, code, Boolean(options.sourcemap), 'bytecode');
		},
	};
}

/**
 * @description Lowers the shipped JavaScript after hermesc compiled its bytecode, since the loader falls back
 * to it on a Hermes that compiles it from source without {@link HERMESC_FEATURE_FLAGS}.
 * @returns A rolldown plugin to place after the hermesc plugin.
 */
export function lowerSourceFallback(): Plugin {
	// rolldown writes a chunk's map from its own copy, so the lowered maps are written over it afterwards.
	const maps = new Map<string, string>();

	return {
		name: 'lower-source-fallback',
		generateBundle(_options, bundle) {
			maps.clear();

			for (const output of Object.values(bundle)) {
				if (output.type !== 'chunk') {
					continue;
				}

				// `var global` stays on the global object; the rest, with the helpers swc adds, goes in a wrapper.
				const banner = output.code.startsWith(GLOBAL_BANNER) ? GLOBAL_BANNER : '';
				const map = output.map
					? parse(sourceMapSchema, JSON.parse(JSON.stringify(output.map)))
					: undefined;
				const lowered = transformSync(output.code.slice(banner.length), {
					swcrc: false,
					configFile: false,
					isModule: false,
					minify: true,
					sourceMaps: Boolean(map),
					// The banner is one whole line, so the body's map drops that line.
					inputSourceMap: map
						? JSON.stringify({
								...map,
								mappings: map.mappings.slice(
									banner ? map.mappings.indexOf(';') + 1 : 0,
								),
							})
						: undefined,
					jsc: {
						parser: { syntax: 'ecmascript' },
						minify: { compress: true, mangle: true },
					},
					// A modern target lowers only the flagged features.
					env: { targets: 'chrome 120', include: FLAGGED_TRANSFORMS },
				});

				output.code = `${banner}${WRAPPER_HEAD}${lowered.code}\n})();`;

				if (map && lowered.map) {
					const result = parse(sourceMapSchema, JSON.parse(lowered.map));
					// One empty mappings line for the banner and one for the wrapper head.
					const offset = ';'.repeat(
						(banner ? 1 : 0) + WRAPPER_HEAD.split('\n').length - 1,
					);

					maps.set(
						`${output.fileName}.map`,
						JSON.stringify({ ...result, mappings: offset + result.mappings }),
					);
				}
			}
		},
		async writeBundle(options) {
			const dir = options.dir ?? (options.file ? dirname(options.file) : undefined);

			if (!dir) return;

			await Promise.all([...maps].map(([file, map]) => writeFile(join(dir, file), map)));
		},
	};
}
