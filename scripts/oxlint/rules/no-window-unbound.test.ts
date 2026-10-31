import { expect, test } from 'bun:test';

import { flaggedFiles, lintFixture } from '../lint-fixture';

test('flags every way of writing window.unbound', async () => {
	const findings = await lintFixture('no-window-unbound', {
		'src/import.ts': "import { metro } from '@unbound-app/api';\nexport const m = metro;",
		'src/scoped.ts': 'export const m = unbound.metro;',
		'src/other-global.ts': 'export const n = window.navigator;',
		'src/lookalike.ts': "export const s = 'window.unboundish';",
		'src/member.ts': 'export const m = window.unbound.metro;',
		'src/computed.ts': "export const m = window['unbound'];",
		'src/global-this.ts': 'globalThis.unbound.patcher.unpatchAll();',
		'src/assign.ts': 'window.unbound = {};',
		'rollup.config.mjs':
			"export default { globals: { '@unbound-app/api': 'window.unbound' } };",
		'globals.mjs': 'export const name = (id) => `window.unbound.${id}`;',
	});

	expect(flaggedFiles(findings)).toEqual([
		'globals.mjs',
		'rollup.config.mjs',
		'src/assign.ts',
		'src/computed.ts',
		'src/global-this.ts',
		'src/member.ts',
	]);
});
