import { describe, expect, mock, test } from 'bun:test';

import { startFakeMetro } from './helpers/fake-metro';
import { createCacheMock } from './helpers/cache';

const IDS = [7, 8];

Object.assign(globalThis, { window: globalThis, $$DEV$$: false });

const fakeMetro = startFakeMetro();

for (const id of IDS) {
	fakeMetro.define(id, [], (_, __, ___, ____, module) => {
		module.exports = { id };
	});
}

mock.module('~/metro/cache', () =>
	createCacheMock({
		state: { moduleFlags: {} },
		getModuleIds: () => IDS,
		hasModuleFlag: () => false,
		addModuleFlag: () => void 0,
	}),
);

const metro = await import('~/metro/search');

describe('metro.onModuleLoad', () => {
	test('calls the listener with each loaded module until it is removed', () => {
		const calls: [unknown, number][] = [];
		const remove = metro.onModuleLoad((mdl, id) => void calls.push([mdl, id]));

		fakeMetro.require(7);
		remove();
		fakeMetro.require(8);

		expect(calls).toEqual([[{ id: 7 }, 7]]);
	});
});
