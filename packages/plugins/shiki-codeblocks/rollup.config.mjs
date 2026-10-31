import { unbound } from '@unbound-app/cli/rollup';

import { lazyBundled } from './rollup/lazy-bundled.mjs';

const config = unbound(import.meta.url, {
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
