import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { Plugin } from '@unbound-app/types';

import type { AddonAttribution } from '~/addons/crash-guard';
import type { CrashEvent } from '~/diagnostics/crash-report';
import type { PluginScope } from '~/addons/scope';
import type { Addon } from '~/addons/addon';

const LOADED_ID = 1;
const loadedExports = { loaded: (value: number) => value };
const records = new Map<number, MetroModuleRecord>([
	[LOADED_ID, { isInitialized: true, publicModule: { id: LOADED_ID, exports: loadedExports } }],
]);
const methods = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];

for (const [index, method] of methods.entries()) {
	const id = index + 2;
	const exported = { [method]: (value: number) => value };

	records.set(id, {
		isInitialized: false,
		publicModule: { id, exports: {} },
		factory: (...args: Parameters<MetroDefine>) => void (args[4].exports = exported),
	});
}

let searchLoads = 0;

function load(id: number) {
	const record = records.get(id);

	if (!record || record.isInitialized) {
		return record?.publicModule.exports;
	}

	record.factory?.(globalThis, __r, null, null, record.publicModule);
	record.isInitialized = true;

	return record.publicModule.exports;
}

Object.assign(globalThis, {
	window: globalThis,
	React: { createElement: () => null },
	modules: records,
	$$DEV$$: false,
	ErrorUtils: { getGlobalHandler: () => void 0, setGlobalHandler: () => void 0 },
	__r: (id: number) => {
		searchLoads++;

		return load(id);
	},
});

mock.module('~/metro/cache', () => ({
	default: {
		moduleIds: [...records.keys()],
		hasModuleFlag: () => false,
		addModuleFlag: () => void 0,
		getModuleCacheForKey: () => void 0,
		addCachedIDForKey: () => void 0,
	},
	ModuleFlags: { BLACKLISTED: 1 },
}));

mock.module('~/metro/wrappers', () => ({
	findByPropsLazy: () => ({ getPublicInstanceFromRootTag: () => null }),
}));

const crashes: CrashEvent[] = [];

mock.module('~/diagnostics/crash-reports', () => ({
	reportCrash: async (event: CrashEvent) => void crashes.push(event),
}));

const { FakeAddons, makeManifest, resetDevice, states } = await import('./helpers/addons');
const { after, createPatcher, instead, unpatchAll, unpatchAllByCaller } =
	await import('~/patcher/api');
const { findByProps } = await import('~/metro/lookups');
const { createAddonScope } = await import('~/addons/scope');

function idOf(method: string) {
	return methods.indexOf(method) + 2;
}

function exportsOf(method: string) {
	return records.get(idOf(method))?.publicModule.exports;
}

afterEach(() => {
	unpatchAll();
	searchLoads = 0;
});

describe('lazy patch targets', () => {
	test('a patch on a lazy target applies when its module loads, with no search before', () => {
		const target = findByProps('first');

		after(target, 'first', (ctx) => ctx.result * 10);

		expect(searchLoads).toBe(0);
		expect(records.get(idOf('first'))?.isInitialized).toBe(false);

		load(idOf('first'));

		expect(exportsOf('first').first(2)).toBe(20);
		expect(searchLoads).toBe(0);
	});

	test('unpatching before the module loads leaves nothing behind', () => {
		const original = records.get(idOf('second'))?.factory;
		const unpatch = after(findByProps('second'), 'second', () => 0);
		const patcher = createPatcher('plugin');

		patcher.after(findByProps('second'), 'second', () => 1);
		createPatcher('stopped-plugin').after(findByProps('second'), 'second', () => 2);

		unpatch();
		patcher.unpatchAll();
		unpatchAllByCaller('stopped-plugin');

		load(idOf('second'));

		expect(exportsOf('second').second(5)).toBe(5);
		expect(records.get(idOf('second'))?.factory).toBe(original);
		expect(searchLoads).toBe(0);
	});

	test('a patch on a lazy target whose module already loaded applies at once', () => {
		after(findByProps('loaded'), 'loaded', (ctx) => ctx.result + 1);

		expect(loadedExports.loaded(1)).toBe(2);
		expect(searchLoads).toBe(0);
	});

	test('unpatchAll drops a patch still waiting for its module', () => {
		after(findByProps('third'), 'third', () => 0);
		unpatchAll();
		load(idOf('third'));

		expect(exportsOf('third').third(3)).toBe(3);
	});
});

class AttributedAddons extends FakeAddons {
	attributed: string[] = [];
	starts = new Map<string, (scope?: PluginScope) => void>();

	protected createScope(entity: Addon<Plugin>): PluginScope {
		return createAddonScope(entity);
	}

	protected handleBundle(bundle: string, _id?: string, scope?: PluginScope) {
		return { start: () => this.starts.get(bundle)?.(scope), stop: () => {} };
	}

	protected attribution(entity: Addon<Plugin>): AddonAttribution {
		return (method) =>
			(...args) => {
				this.attributed.push(entity.id);

				return method(...args);
			};
	}
}

describe('deferred patches', () => {
	test('stay attributed to the addon that registered them and report its failures', () => {
		const manager = new AttributedAddons();

		resetDevice();
		states['addon.a'] = true;
		states['addon.b'] = true;
		manager.starts.set('addon.a', () => {
			after(findByProps('sixth'), 'sixth', (ctx) => ctx.result * 10);
			instead(findByProps('seventh'), 'missing' as 'seventh', () => 0);
		});
		manager.starts.set('addon.b', () => {
			load(idOf('sixth'));
			load(idOf('seventh'));
		});

		manager.load('addon.a', makeManifest('addon.a'));
		manager.load('addon.b', makeManifest('addon.b'));
		manager.attributed.length = 0;

		expect(exportsOf('sixth').sixth(2)).toBe(20);
		expect(manager.attributed).toEqual(['addon.a']);
		expect(manager.errors.get('addon.a')?.message).toContain('does not exist');
		expect(manager.getEntity('addon.a')?.failed).toBe(true);
		expect(manager.errors.has('addon.b')).toBe(false);
		expect(manager.getEntity('addon.b')?.started).toBe(true);
		expect(crashes.map((crash) => [crash.addon?.id, crash.kind, crash.phase])).toEqual([
			['addon.a', 'start-failure', 'running'],
		]);
	});

	test('made through a scoped patcher stay attributed to its addon', () => {
		const manager = new AttributedAddons();

		resetDevice();
		states['addon.c'] = true;
		manager.starts.set('addon.c', (scope) => {
			scope?.globals.patcher.after(findByProps('eighth'), 'eighth', (ctx) => ctx.result * 10);
		});

		manager.load('addon.c', makeManifest('addon.c'));
		manager.attributed.length = 0;
		load(idOf('eighth'));

		expect(manager.attributed).toEqual(['addon.c']);
		expect(exportsOf('eighth').eighth(2)).toBe(20);
	});
});

describe('addon-facing lookups', () => {
	test('are lazy by default', () => {
		const lookup = findByProps('fourth');

		expect(searchLoads).toBe(0);
		expect(lookup.fourth(4)).toBe(4);
		expect(searchLoads).toBe(1);
	});

	test('search at once with { lazy: false }', () => {
		const lookup = findByProps('fifth', { lazy: false });

		expect(searchLoads).toBe(1);
		expect(lookup).toBe(exportsOf('fifth'));
	});

	test('search at once for every match with { all: true }', () => {
		const matches = findByProps('loaded', { all: true });

		expect(Array.isArray(matches)).toBe(true);
		expect(matches).toContain(loadedExports);
	});
});
