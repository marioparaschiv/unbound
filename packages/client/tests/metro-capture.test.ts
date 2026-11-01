import { describe, expect, mock, test } from 'bun:test';

import { startFakeMetro } from './helpers/fake-metro';

const TRACKER = 2;
const EARLY = 3;
const DISCORD = 4;
const COUNTED = 5;
const THROWS = 6;
const FLAGGED = 7;
const LISTENED = 8;

Object.assign(globalThis, {
	$$DEV$$: false,
	window: globalThis,
	ErrorUtils: { getGlobalHandler: () => undefined, setGlobalHandler: () => undefined },
});

const metro = startFakeMetro();
const moduleFlags: Record<number, number> = { [FLAGGED]: 1 };
let countedRuns = 0;

metro.define(TRACKER, [], (_, __, ___, ____, module) => {
	module.exports = { fileFinishedImporting: () => undefined };
});
metro.define(EARLY, [TRACKER], (_, require, ___, ____, module, _____, deps) => {
	module.exports = { early: true };
	require(deps[0]).fileFinishedImporting('modules/early.tsx');
});
metro.define(DISCORD, [TRACKER], (_, require, ___, ____, module, _____, deps) => {
	module.exports = { discord: true };
	require(deps[0]).fileFinishedImporting('modules/debug/Logger.tsx');
});
metro.define(COUNTED, [], (_, __, ___, ____, module) => {
	countedRuns++;
	module.exports = { counted: true };
});
metro.define(THROWS, [], () => {
	throw new Error('factory failed');
});
metro.define(FLAGGED, [], (_, __, ___, ____, module) => {
	module.exports = { flagged: true };
});
metro.define(LISTENED, [], (_, __, ___, ____, module) => {
	module.exports = { listened: true };
});

const definedFactories = [...globalThis.modules.values()].map((record) => record.factory);

// Modules Discord runs before Unbound's client loads, as InitializeCore does.
metro.require(EARLY);
metro.require(COUNTED);

mock.module('~/metro/cache', () => ({
	ModuleFlags: { BLACKLISTED: 1 },
	default: {
		state: { moduleFlags },
		moduleIds: [...globalThis.modules.keys()],
		hasModuleFlag: (id: number, flag: number) => Boolean(moduleFlags[id] & flag),
		addModuleFlag(id: number, flag: number) {
			moduleFlags[id] |= flag;
		},
		getModuleCacheForKey: () => undefined,
		isKeyMissing: () => false,
		getHintsForKey: () => undefined,
		addCachedIDForKey: () => undefined,
		markKeyMissing: () => undefined,
	},
}));

const search = await import('~/metro/search');
const { blacklist } = await import('~/metro/state');
const { onModuleLoaded } = await import('~/metro/wait');
const { byProps } = await import('~/metro/filters');

describe('the define stage', () => {
	test('defines every module with one shared factory and exposes the registry', () => {
		expect(definedFactories).toHaveLength(7);
		expect(new Set(definedFactories).size).toBe(1);
		expect(typeof definedFactories[0]).toBe('function');
	});

	test('runs each original factory exactly once', () => {
		metro.require(COUNTED);
		metro.require(COUNTED);

		expect(countedRuns).toBe(1);
		expect(metro.require(COUNTED)).toEqual({ counted: true });
	});

	test('records the file path of a module that runs after the client loads', () => {
		metro.require(DISCORD);

		expect(globalThis.modules.get(DISCORD)?.__filePath).toBe('modules/debug/Logger.tsx');
		expect(search.findByFilePath('modules/debug/Logger.tsx')).toEqual({ discord: true });
	});

	test('notifies module listeners when a module loads', () => {
		const loaded: MetroExport[] = [];

		onModuleLoaded(byProps('listened'), (mdl) => void loaded.push(mdl));
		metro.require(LISTENED);

		expect(loaded).toEqual([{ listened: true }]);
	});

	test('blacklists a module whose factory throws', () => {
		expect(() => metro.require(THROWS)).not.toThrow();
		expect(blacklist.has(THROWS)).toBe(true);
		expect(moduleFlags[THROWS]).toBe(1);
	});

	test('runs a module flagged as blacklisted without notifying listeners', () => {
		const seen: number[] = [];
		const remove = search.onModuleLoad((_, id) => void seen.push(id));

		expect(metro.require(FLAGGED)).toEqual({ flagged: true });
		remove();

		expect(blacklist.has(FLAGGED)).toBe(true);
		expect(seen).toEqual([]);
	});
});
