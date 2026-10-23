import type { Options, Output } from '@swc/core';
import { transformSync } from '@swc/core';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'rolldown';
import { join } from 'node:path';

/**
 * @description Lowers bundled code to the `.swcrc` env targets, which older Hermes needs for classes and async functions.
 * @param root The package root holding the `.swcrc` whose `env` is applied.
 * @param code The bundled code to lower.
 * @param sourceMaps Whether to also return a source map from the lowered code back to `code`.
 * @returns The lowered code, with swc's helpers declared at its top level, and its map when asked for.
 */
export function lower(root: string, code: string, sourceMaps: boolean = false): Output {
	const { env }: Options = JSON.parse(readFileSync(join(root, '.swcrc'), 'utf8'));
	// Lowered classes carry "use strict", which hermesc rejects in a function with non-simple parameters.
	const exclude = env?.exclude?.filter((name) => name !== 'transform-parameters');

	return transformSync(code, {
		swcrc: false,
		configFile: false,
		sourceMaps,
		jsc: { parser: { syntax: 'ecmascript' } },
		env: { ...env, exclude },
	});
}

// The wrapper keeps swc's helpers out of Discord's globals.
const WRAPPER_HEAD = '(() => {\n';

export type LoweredChunk = {
	code: string;
	map?: string;
};

/**
 * @description Lowers a rendered chunk and wraps it in a function scope.
 * @param root The package root holding the `.swcrc` whose `env` is applied.
 * @param code The rendered chunk.
 * @param sourceMaps Whether to also return a source map from the wrapped code back to `code`.
 * @returns The wrapped code, and its map when asked for.
 */
export function lowerChunk(root: string, code: string, sourceMaps: boolean = false): LoweredChunk {
	const lowered = lower(root, code, sourceMaps);
	const wrapped = `${WRAPPER_HEAD}${lowered.code}\n})();`;

	if (!lowered.map) {
		return { code: wrapped };
	}

	const map = JSON.parse(lowered.map);
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
			return lowerChunk(root, code, Boolean(options.sourcemap));
		},
	};
}
