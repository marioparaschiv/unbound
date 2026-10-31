import { pluginConfig } from '@unbound-app/cli/rollup';

const runtimeGlobals = {
	'@unbound-app/api': 'window.unbound',
	react: 'window.React',
	'react-native': 'window.ReactNative',
};

// `@unbound-app/api/metro/components` maps to `window.unbound.metro.components`, mirroring the API's namespaces.
function globals(id) {
	if (id.startsWith('@unbound-app/api/')) {
		return `window.unbound.${id.slice('@unbound-app/api/'.length).replaceAll('/', '.')}`;
	}

	return runtimeGlobals[id];
}

/**
 * Builds the rollup config for plugins not yet moved to `unbound` from `@unbound-app/cli/rollup`, which reads bare globals instead of `window.*`.
 * @param {string} pluginUrl The `import.meta.url` of the plugin's `rollup.config.mjs`.
 * @param {import('@unbound-app/cli/rollup').PluginConfigOptions} options See `unbound` from `@unbound-app/cli/rollup`.
 */
export function createPluginConfig(pluginUrl, options = {}) {
	return pluginConfig(pluginUrl, globals, options);
}

export {
	bytecodeFileName,
	bytecodeSource,
	hermesBytecode,
	hermesExpressionEntrypoint,
	lazyModules,
	lazyModuleSource,
	sourceAlias,
} from '@unbound-app/cli/rollup';
