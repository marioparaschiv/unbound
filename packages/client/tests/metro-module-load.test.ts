import { describe, expect, mock, test } from 'bun:test';

import { startFakeMetro } from './helpers/fake-metro';

const IDS = [7, 8, 9, 10];

Object.assign(globalThis, { window: globalThis, $$DEV$$: false });

const fakeMetro = startFakeMetro();

for (const id of IDS) {
	fakeMetro.define(id, [], (_, __, ___, ____, module) => {
		module.exports = { id };
	});
}

mock.module('~/metro/cache', () => ({
	default: {
		state: { moduleFlags: {} },
		moduleIds: IDS,
		hasModuleFlag: () => false,
		addModuleFlag: () => void 0,
	},
	ModuleFlags: { BLACKLISTED: 1 },
}));

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

	test('keeps addListener, on and off as aliases', () => {
		const calls: number[] = [];

		function listener(_mdl: MetroExport, id: number) {
			calls.push(id);
		}

		metro.addListener(listener);
		metro.on(listener);
		fakeMetro.require(9);
		metro.off(listener);
		fakeMetro.require(10);

		expect(metro.addListener).toBe(metro.onModuleLoad);
		expect(metro.on).toBe(metro.onModuleLoad);
		expect(calls).toEqual([9]);
	});
});
