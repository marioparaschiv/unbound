import { describe, expect, mock, test } from 'bun:test';

const MODULE_ID = 7;
const exported = { marker: true };

function factory(...args: Parameters<MetroDefine>) {
	args[4].exports = exported;
}

const record: MetroModuleRecord = { factory, publicModule: { id: MODULE_ID, exports: {} } };

Object.assign(globalThis, {
	window: globalThis,
	modules: new Map([[MODULE_ID, record]]),
	$$DEV$$: false,
});

mock.module('~/lib/cache', () => ({
	default: { moduleIds: [MODULE_ID], hasModuleFlag: () => false, addModuleFlag: () => void 0 },
	ModuleFlags: { BLACKLISTED: 1 },
}));

const metro = await import('~/api/metro/search');

function requireModuleOnce() {
	record.factory?.(globalThis, () => void 0, null, null, { id: MODULE_ID, exports: {} });
}

describe('metro.onModuleLoad', () => {
	test('calls the listener with each loaded module until it is removed', () => {
		const calls: [unknown, number][] = [];
		const remove = metro.onModuleLoad((mdl, id) => void calls.push([mdl, id]));

		requireModuleOnce();
		remove();
		requireModuleOnce();

		expect(calls).toEqual([[exported, MODULE_ID]]);
	});

	test('keeps addListener, on and off as aliases', () => {
		const calls: number[] = [];

		function listener(_mdl: MetroExport, id: number) {
			calls.push(id);
		}

		metro.addListener(listener);
		metro.on(listener);
		requireModuleOnce();
		metro.off(listener);
		requireModuleOnce();

		expect(metro.addListener).toBe(metro.onModuleLoad);
		expect(metro.on).toBe(metro.onModuleLoad);
		expect(calls).toEqual([MODULE_ID]);
	});
});
