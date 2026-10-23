import { transformSync } from '@swc/core';
import type { Options } from '@swc/core';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'rolldown';
import { join } from 'node:path';

/**
 * @description Lowers bundled code to the `.swcrc` env targets, which older Hermes needs for classes and async functions.
 * @param root The package root holding the `.swcrc` whose `env` is applied.
 * @param code The bundled code to lower.
 * @returns The lowered code, wrapped in an arrow function so swc's helpers stay out of Discord's globals.
 */
export function lower(root: string, code: string): string {
	const { env }: Options = JSON.parse(readFileSync(join(root, '.swcrc'), 'utf8'));
	// Lowered classes carry "use strict", which hermesc rejects in a function with non-simple parameters.
	const exclude = env?.exclude?.filter((name) => name !== 'transform-parameters');

	const lowered = transformSync(code, {
		swcrc: false,
		configFile: false,
		sourceMaps: false,
		jsc: { parser: { syntax: 'ecmascript' } },
		env: { ...env, exclude },
	}).code;

	return `(() => {\n${lowered}\n})();`;
}

/**
 * @description Lowers each rendered chunk after tree-shaking and before minification, so dependencies stay tree-shakeable.
 * @param root The package root holding the `.swcrc` whose `env` is applied.
 * @returns A rolldown plugin down-levelling every rendered chunk.
 */
export default function downlevel(root: string): Plugin {
	return {
		name: 'downlevel',
		renderChunk(code) {
			return lower(root, code);
		},
	};
}
