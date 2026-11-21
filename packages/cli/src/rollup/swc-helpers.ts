import { fileURLToPath } from 'node:url';
import type { Plugin } from 'rollup';

const HELPERS = '@swc/helpers';

/**
 * @description Resolves the `@swc/helpers` imports swc emits with `externalHelpers` from this CLI's own install, so
 * each helper is bundled once per plugin instead of copied into every module, in any plugin repository.
 * @returns The rollup plugin.
 */
export function swcHelpers(): Plugin {
	return {
		name: 'swc-helpers',
		resolveId(source) {
			if (source !== HELPERS && !source.startsWith(`${HELPERS}/`)) return null;

			return fileURLToPath(import.meta.resolve(source));
		},
	};
}

export default { swcHelpers };
