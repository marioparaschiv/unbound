import type { Plugin } from 'rollup';

/**
 * @description Rewrites each chunk into the object expression the client evaluates: `__load()` runs the plugin's
 * module once and returns its named exports, which the client reads as `start`, `stop` and `SettingsPanel`.
 * @returns The rollup plugin.
 */
export function hermesExpressionEntrypoint(): Plugin {
	return {
		name: 'hermes-expression-entrypoint',
		generateBundle(_outputOptions, bundle) {
			for (const chunk of Object.values(bundle)) {
				if (chunk.type !== 'chunk') {
					continue;
				}

				const code = chunk.code
					.trim()
					.replace(/^var\s+[A-Za-z_$][\w$]*\s*=\s*/, '')
					.replace(/;\s*$/, '');

				chunk.code = `({__plugin:null,__load(){if(this.__plugin)return this.__plugin;this.__plugin=${code};return this.__plugin;}})`;
			}
		},
	};
}

export default hermesExpressionEntrypoint;
