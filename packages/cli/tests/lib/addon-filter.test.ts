import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';

import { namedAddons, unknownAddonNames } from '~/lib/addon-filter';

const addons = [
	{ id: 'unbound.chat-bubbles', dir: resolve('plugins/chat-bubbles') },
	{ id: 'unbound.dearrow', dir: resolve('plugins/dearrow') },
];

describe('namedAddons', () => {
	test('keeps every addon when none is named', () => {
		expect(namedAddons(addons, [])).toEqual(addons);
	});

	test('keeps addons named by id or directory', () => {
		expect(namedAddons(addons, ['unbound.dearrow']).map((addon) => addon.id)).toEqual([
			'unbound.dearrow',
		]);
		expect(namedAddons(addons, ['plugins/chat-bubbles']).map((addon) => addon.id)).toEqual([
			'unbound.chat-bubbles',
		]);
	});

	test('reports names that match no addon', () => {
		expect(unknownAddonNames(addons, ['unbound.dearrow', 'unbound.missing'])).toEqual([
			'unbound.missing',
		]);
	});
});
