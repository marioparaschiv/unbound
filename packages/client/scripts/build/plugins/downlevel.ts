import { transformSync } from '@swc/core';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'rolldown';
import { join } from 'node:path';
import { z } from 'zod';

const WRAPPER_HEAD = '(() => {\n';

// Checks the `env` keys this plugin reads and passes any other `env` key through to swc.
const swcrcSchema = z.object({
	env: z.optional(
		z.looseObject({
			targets: z.optional(z.string()),
			include: z.optional(z.array(z.string())),
			exclude: z.optional(z.array(z.string())),
		}),
	),
});

const sourceMapSchema = z.looseObject({ mappings: z.string() });

export type Lowered = {
	code: string;
	map?: string;
};

/**
 * @description Lowers bundled code to the `.swcrc` env targets for older Hermes, and wraps it so its helpers stay scoped.
 * @param root The package root holding the `.swcrc` whose `env` is applied.
 * @param code The bundled code to lower.
 * @param sourceMaps Whether to also return a source map from the wrapped code back to `code`.
 * @returns The lowered code wrapped in an arrow function, keeping swc's helpers out of Discord's globals, and its map when asked for.
 */
export function lower(root: string, code: string, sourceMaps: boolean = false): Lowered {
	const { env } = swcrcSchema.parse(JSON.parse(readFileSync(join(root, '.swcrc'), 'utf8')));
	// Lowered classes carry "use strict", which hermesc rejects in a function with non-simple parameters.
	const exclude = env?.exclude?.filter((name) => name !== 'transform-parameters');

	const lowered = transformSync(code, {
		swcrc: false,
		configFile: false,
		sourceMaps,
		jsc: { parser: { syntax: 'ecmascript' } },
		env: { ...env, exclude },
	});
	const wrapped = `${WRAPPER_HEAD}${lowered.code}\n})();`;

	if (!lowered.map) {
		return { code: wrapped };
	}

	const map = sourceMapSchema.parse(JSON.parse(lowered.map));
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
			return lower(root, code, Boolean(options.sourcemap));
		},
	};
}
