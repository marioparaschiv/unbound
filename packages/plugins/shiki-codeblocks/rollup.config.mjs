import { createPluginConfig } from '@unbound-plugins/rollup-config';

import { lazyBundled } from './rollup/lazy-bundled.mjs';

const config = createPluginConfig(import.meta.url, {
	settingsPanel: true,
	lazyModules: [
		'highlight.js/lib/common',
		'shiki/core',
		'shiki/engine/javascript',
		'jsonc-parser',
	],
});

config.plugins.unshift(lazyBundled());

export default config;
