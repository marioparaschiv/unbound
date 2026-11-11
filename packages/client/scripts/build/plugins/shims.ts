import type { Plugin } from 'rolldown';

type GlobalsConfig = Record<string, string>;

/**
 * @description Replaces the configured module ids with the global expression each maps to.
 * @param config A map of module id to the global expression that provides it.
 * @returns A rolldown plugin resolving those modules to their globals.
 */
export default function globals(config: GlobalsConfig): Plugin {
	return {
		name: 'globals',

		resolveId(id) {
			if (id in config) {
				return '\0global:' + id;
			}

			return null;
		},

		load(id) {
			if (id.startsWith('\0global:')) {
				const moduleName = id.slice(8);
				const globalName = config[moduleName];

				return `module.exports = ${globalName};`;
			}

			return null;
		},
	};
}
