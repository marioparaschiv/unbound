import { describe, expect, test } from 'bun:test';

import { renameApi, sdkPaths } from './rename-api';
import { API_RENAMES } from './api-renames';

function rename(text: string, fileName: string = 'plugin.tsx') {
	return renameApi(text, fileName, API_RENAMES);
}

describe('API rename codemod', () => {
	test('renames members reached through a namespace import', () => {
		const { text, applied } = rename(
			[
				"import { metro, toasts } from '@unbound-app/api';",
				'',
				"toasts.showToast({ title: 'Hi' });",
				"metro.filters.byStore('User');",
			].join('\n'),
		);

		expect(text).toBe(
			[
				"import { metro, toasts } from '@unbound-app/api';",
				'',
				"toasts.show({ title: 'Hi' });",
				"metro.filters.byFluxStore('User');",
			].join('\n'),
		);
		expect(applied.map((entry) => entry.from)).toEqual([
			'metro.filters.byStore',
			'toasts.showToast',
		]);
	});

	test('renames members reached through subpath imports and the global', () => {
		const { text } = rename(
			[
				"import * as filters from '@unbound-app/api/metro/filters';",
				"filters.byStore('User');",
				"window.unbound.fs.read('a');",
				"unbound.assets.getIDByName('b');",
			].join('\n'),
		);

		expect(text).toBe(
			[
				"import * as filters from '@unbound-app/api/metro/filters';",
				"filters.byFluxStore('User');",
				"window.unbound.fs.readFile('a');",
				"unbound.assets.getIdByName('b');",
			].join('\n'),
		);
	});

	test('moves a member to another namespace and drops the import it no longer needs', () => {
		const { text } = rename(
			[
				"import { metro, patcher } from '@unbound-app/api';",
				'',
				"const Users = metro.findStore('User');",
				"patcher.after('x', Users, 'getUser', () => {});",
			].join('\n'),
		);

		expect(text).toBe(
			[
				"import { patcher, flux } from '@unbound-app/api';",
				'',
				"const Users = flux.getStore('User');",
				"patcher.after('x', Users, 'getUser', () => {});",
			].join('\n'),
		);
	});

	test('keeps the old namespace import while other code still uses it', () => {
		const { text } = rename(
			[
				"import { metro } from '@unbound-app/api';",
				"const Users = metro.findStore('User');",
				"const Profiles = metro.findByProps('getProfile');",
			].join('\n'),
		);

		expect(text).toBe(
			[
				"import { metro, flux } from '@unbound-app/api';",
				"const Users = flux.getStore('User');",
				"const Profiles = metro.findByProps('getProfile');",
			].join('\n'),
		);
	});

	test('moves a member through a root namespace import and the global', () => {
		const { text } = rename(
			[
				"import * as api from '@unbound-app/api';",
				"api.metro.findStore('User');",
				"window.unbound.metro.findStore('Guild');",
			].join('\n'),
		);

		expect(text).toBe(
			[
				"import * as api from '@unbound-app/api';",
				"api.flux.getStore('User');",
				"window.unbound.flux.getStore('Guild');",
			].join('\n'),
		);
	});

	test('renames a namespace import, then its members', () => {
		const { text } = rename(
			["import { icons } from '@unbound-app/api';", 'icons.getEntities();'].join('\n'),
		);

		expect(text).toBe(
			["import { iconPacks as icons } from '@unbound-app/api';", 'icons.getAll();'].join(
				'\n',
			),
		);
	});

	test('leaves locals and other modules alone', () => {
		const source = [
			"import { storage } from '@unbound-app/api';",
			"import toasts from './toasts';",
			'',
			"const settings = storage.getStore('plugin');",
			"settings.get('enabled', true);",
			"toasts.showToast({ title: 'local' });",
		].join('\n');

		expect(rename(source).text).toBe(source.replace('storage.getStore', 'storage.getBucket'));
	});

	test('reports a move whose target name is already taken', () => {
		const source = [
			"import { metro } from '@unbound-app/api';",
			'const flux = 1;',
			"metro.findStore('User');",
		].join('\n');
		const result = rename(source);

		expect(result.text).toBe(source);
		expect(result.manual).toEqual(['metro.findStore (the name flux is taken)']);
	});

	test('is idempotent', () => {
		const first = rename(
			[
				"import { metro, storage } from '@unbound-app/api';",
				"metro.findStore('User');",
				"storage.getStore('a').get('b', 1);",
			].join('\n'),
		);
		const second = rename(first.text);

		expect(second.text).toBe(first.text);
		expect(second.applied).toEqual([]);
	});

	test('applies only the renames it is given', () => {
		const source = "import { toasts } from '@unbound-app/api';\ntoasts.showToast({});";

		expect(renameApi(source, 'plugin.ts', []).text).toBe(source);
	});
});

describe('API rename table', () => {
	test('lists each old name once and never renames to an old name', () => {
		const from = API_RENAMES.map((entry) => entry.from);

		expect(new Set(from).size).toBe(from.length);
		expect(API_RENAMES.filter((entry) => from.includes(entry.to))).toEqual([]);
	});

	test('reads dotted paths from the generated SDK', () => {
		const paths = sdkPaths();

		expect(paths.has('metro.findByProps')).toBe(true);
		expect(paths.has('metro.filters.byProps')).toBe(true);
		expect(paths.has('patcher.after')).toBe(true);
	});
});
