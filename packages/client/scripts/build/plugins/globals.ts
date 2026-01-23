import type { Plugin } from 'rolldown';

type GlobalsConfig = Record<string, string>;

export default function globals(config: GlobalsConfig): Plugin {
	return {
		name: 'globals',
		resolveId(id) {
			// Check if this module should be replaced with a global
			if (id in config) {
				return '\0global:' + id;
			}
			return null;
		},
		load(id) {
			// If this is a global module, return the global reference
			if (id.startsWith('\0global:')) {
				const moduleName = id.slice(8); // Remove '\0global:' prefix
				const globalName = config[moduleName];

				// Return: module.exports = window.GlobalName (or globalThis.GlobalName)
				return `module.exports = ${globalName};`;
			}
			return null;
		},
	};
}
