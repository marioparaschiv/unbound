import type { Plugin } from 'rollup';

type EntrypointOptions = { hasSettingsPanel?: boolean };

/**
 * @description Rewrites each chunk into the object expression the client evaluates, loading the plugin on first use.
 * @param options Set `hasSettingsPanel` when the plugin exports `getSettingsPanel`.
 * @returns The rollup plugin.
 */
export function hermesExpressionEntrypoint({
	hasSettingsPanel = false,
}: EntrypointOptions = {}): Plugin {
	const settingsPanelMethod = hasSettingsPanel
		? `,getSettingsPanel(...args){const module=this.__load();const plugin=module?.default??module;const settingsPanel=plugin?.getSettingsPanel??module?.getSettingsPanel;if(typeof settingsPanel==='function')return settingsPanel.apply(plugin,args);return null;}`
		: '';

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

				chunk.code = `({__plugin:null,__load(){if(this.__plugin)return this.__plugin;this.__plugin=${code};return this.__plugin;},start(context){const module=this.__load();const plugin=module?.default??module;if(plugin&&typeof plugin.start==='function')return plugin.start(context);},stop(){const module=this.__load();const plugin=module?.default??module;if(plugin&&typeof plugin.stop==='function')return plugin.stop();},selfTest(){const module=this.__load();const plugin=module?.default??module;if(plugin&&typeof plugin.selfTest==='function')return plugin.selfTest();}${settingsPanelMethod}})`;
			}
		},
	};
}

export default hermesExpressionEntrypoint;
