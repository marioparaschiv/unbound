import { describe, expect, test } from 'bun:test';

import { flaggedFiles, lintFixture } from '../lint-fixture';

const files = {
	'lazy.ts': "export const Store = metro.findStore('User', { lazy: true });",
	'in-function.ts': "export function store() { return metro.findStore('User'); }",
	'in-arrow.ts': "export const store = () => flux.getStore('UserStore');",
	'in-method.ts': "export default { start() { metro.findByProps('sendMessage'); } };",
	'storage.ts': "export const settings = storage.getStore('unbound.moyai');",
	'unrelated.ts': "export const row = rows.findByProps('id');",
	'eager.ts': "export const Store = metro.findStore('User', { lazy: false });",
	'scoped.ts':
		"export const Messages = unbound.metro.findByProps('sendMessage', { lazy: false });",
	'flux.ts': "export const Users = flux.getStore('UserStore', { lazy: false });",
	'imported.ts': [
		"import { findByName as byName } from '@unbound-app/api/metro';",
		"export const Row = byName('RowManager', { interop: false, lazy: false });",
	].join('\n'),
	'variable.ts': "export const Store = metro.findStore('User', { lazy: isLazy });",
	'default.ts': "export const Messages = metro.findByProps('sendMessage');",
	'default-options.ts': "export const Row = metro.findByName('RowManager', { interop: false });",
};

const ALWAYS_EAGER = ['eager.ts', 'flux.ts', 'imported.ts', 'scoped.ts', 'variable.ts'];

describe('no-module-scope-lookup', () => {
	test('flags module-scope lookups without lazy: true while lookups are eager by default', async () => {
		const findings = await lintFixture('no-module-scope-lookup', files);

		expect(flaggedFiles(findings)).toEqual(
			[...ALWAYS_EAGER, 'default-options.ts', 'default.ts'].sort(),
		);
	});

	test('flags only explicit eager lookups once lookups are lazy by default', async () => {
		const findings = await lintFixture('no-module-scope-lookup', files, {
			lazyByDefault: true,
		});

		expect(flaggedFiles(findings)).toEqual(ALWAYS_EAGER);
	});
});
