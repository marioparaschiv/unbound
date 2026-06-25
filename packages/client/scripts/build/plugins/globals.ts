import type { Plugin } from 'rolldown';

type GlobalsConfig = Record<string, string>;

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
			if (!id.startsWith('\0global:')) return null;

			const moduleName = id.slice(8);
			const globalExpr = config[moduleName];
			if (!globalExpr) return null;

			return `module.exports = ${globalExpr};`;
		},
	};
}

export function shimmedModules(modules: string[]): GlobalsConfig {
	return modules.reduce<GlobalsConfig>((config, mod) => {
		config[mod] = `require("#shims#").default[${JSON.stringify(mod)}]`;
		return config;
	}, {});
}
