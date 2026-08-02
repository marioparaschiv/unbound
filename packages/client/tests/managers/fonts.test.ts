import { describe, expect, test, beforeEach } from 'bun:test';
import type { FontEntity } from '@unbound-app/types';

import type { Fonts as FontsManager } from '~/managers/fonts';

import {
	installBinaryFetchMock,
	installCommonMock,
	installFsMock,
	SYNTHETIC_FONTS,
} from '../helpers/discord-fixture';
import { defineGlobal } from '../helpers/metro-fixture';

// Covers the Fonts manager: the `Constants.Fonts` grouping in `getTargets`, the injected-global
// reads (`getFonts`/`initialize`, `getAvailableFonts`), the `font-states` override map and its
// `changed` emissions, and the `install` download path.
//
// The manager patches nothing in JS - the native layer reads `font-states` and hooks the platform
// font loader - so there is no patch surface to assert here.

/** The slice of the host `window` the manager reads its native-injected font lists from. */
interface FontWindow {
	UNBOUND_FONTS?: FontEntity[];
	UNBOUND_AVAILABLE_FONTS?: string[];
}

const settings: Record<string, Record<string, unknown>> = {};
defineGlobal('UNBOUND_SETTINGS', settings);

const hostWindow: FontWindow = {};
defineGlobal<FontWindow>('window', hostWindow);

const common = installCommonMock();
const fsMock = installFsMock();

const { Fonts } = await import('~/managers/fonts');

/** The `font-states` map as storage holds it, created on first write. */
function storedOverrides(): Record<string, string> | undefined {
	return settings.unbound?.['font-states'] as Record<string, string> | undefined;
}

function makeFont(name: string): FontEntity {
	return { name, file: `${name}.ttf`, path: `/docs/Unbound/Fonts/${name}.ttf` };
}

/** Counts `changed` emissions for the lifetime of the returned handle. */
function countChanges(manager: FontsManager) {
	const counter = { count: 0 };
	manager.on('changed', () => void counter.count++);

	return counter;
}

let manager: FontsManager;

beforeEach(() => {
	for (const key of Object.keys(settings)) delete settings[key];

	common.Constants.Fonts = { ...SYNTHETIC_FONTS };
	fsMock.reset();

	delete hostWindow.UNBOUND_FONTS;
	delete hostWindow.UNBOUND_AVAILABLE_FONTS;

	manager = new Fonts();
});

describe('getTargets', () => {
	test('groups keys by their underscore prefix, one target per group', () => {
		const groups = manager.getTargets().map((target) => target.group);

		expect(groups.sort()).toEqual(['CODE', 'DISPLAY', 'MONOSPACE', 'PRIMARY']);
	});

	test('splits a comma-separated value into families and trims each one', () => {
		common.Constants.Fonts = { PRIMARY_A: '  Alpha , Beta  ' };

		expect(manager.getTargets()).toEqual([{ group: 'PRIMARY', families: ['Alpha', 'Beta'] }]);
	});

	test('a family repeated across keys in one group is listed once', () => {
		common.Constants.Fonts = {
			PRIMARY_A: 'Shared',
			PRIMARY_B: 'Shared, Other',
			PRIMARY_C: 'Shared',
		};

		const target = manager.getTargets().find((t) => t.group === 'PRIMARY');

		expect(target?.families).toEqual(['Shared', 'Other']);
	});

	test('a family shared by two groups appears under both - grouping is not a partition', () => {
		const targets = manager.getTargets();
		const withShared = targets
			.filter((t) => t.families.includes('gg sans'))
			.map((t) => t.group);

		expect(withShared.sort()).toEqual(['DISPLAY', 'PRIMARY']);
	});

	test('a key with no underscore forms a group of its own whole name', () => {
		const target = manager.getTargets().find((t) => t.group === 'MONOSPACE');

		expect(target).toEqual({ group: 'MONOSPACE', families: ['Menlo'] });
	});

	test('a non-string value is coerced through String() rather than throwing', () => {
		const target = manager.getTargets().find((t) => t.group === 'PRIMARY');

		expect(target?.families).toContain('500');
	});

	test('an empty Fonts map yields no targets', () => {
		common.Constants.Fonts = {};

		expect(manager.getTargets()).toEqual([]);
	});
});

describe('injected font globals', () => {
	test('initialize registers every injected font by name and marks the manager initialized', () => {
		hostWindow.UNBOUND_FONTS = [makeFont('Inter'), makeFont('Iosevka')];

		manager.initialize();

		expect(manager.getFonts().map((f) => f.name)).toEqual(['Inter', 'Iosevka']);
		expect(manager.getEntity('Inter')?.file).toBe('Inter.ttf');
		expect(manager.initialized).toBe(true);
	});

	test('initialize still completes when the native layer injected no fonts', () => {
		manager.initialize();

		expect(manager.getFonts()).toEqual([]);
		expect(manager.initialized).toBe(true);
	});

	test('getAvailableFonts returns the injected system families, or an empty list when absent', () => {
		expect(manager.getAvailableFonts()).toEqual([]);

		hostWindow.UNBOUND_AVAILABLE_FONTS = ['Helvetica', 'Menlo'];

		expect(manager.getAvailableFonts()).toEqual(['Helvetica', 'Menlo']);
	});
});

describe('override map', () => {
	test('getOverrides defaults to an empty map before anything is written', () => {
		expect(manager.getOverrides()).toEqual({});
	});

	test('setOverride writes the family into unbound/font-states and emits changed once', () => {
		const changes = countChanges(manager);

		manager.setOverride('gg sans', 'Inter');

		expect(storedOverrides()).toEqual({ 'gg sans': 'Inter' });
		expect(changes.count).toBe(1);
	});

	test('setOverride merges into the existing map rather than replacing it', () => {
		manager.setOverride('gg sans', 'Inter');
		manager.setOverride('Menlo', 'Iosevka');

		expect(manager.getOverrides()).toEqual({ 'gg sans': 'Inter', Menlo: 'Iosevka' });
	});

	test('clearOverride removes only the named family and emits changed', () => {
		manager.setOverride('gg sans', 'Inter');
		manager.setOverride('Menlo', 'Iosevka');

		const changes = countChanges(manager);
		manager.clearOverride('gg sans');

		expect(manager.getOverrides()).toEqual({ Menlo: 'Iosevka' });
		expect(changes.count).toBe(1);
	});

	test('MUTATION PROBE: clearOverride on an unset family still writes and emits changed', () => {
		// Correct behaviour would be to bail when the family has no override: the write and the
		// `changed` emit both fire here for a no-op, waking every listener and triggering a
		// debounced settings persist for a map that did not change.
		const changes = countChanges(manager);

		manager.clearOverride('never-set');

		expect(storedOverrides()).toEqual({});
		expect(changes.count).toBe(1);
	});

	test('setOverrideAll writes the native wildcard key', () => {
		manager.setOverrideAll('Inter');

		expect(storedOverrides()).toEqual({ '*': 'Inter' });
	});

	test('clearOverrideAll drops the wildcard and leaves per-family overrides standing', () => {
		manager.setOverride('Menlo', 'Iosevka');
		manager.setOverrideAll('Inter');

		manager.clearOverrideAll();

		expect(manager.getOverrides()).toEqual({ Menlo: 'Iosevka' });
	});
});

describe('install', () => {
	const url = 'https://fonts.example/pack/Inter.ttf';

	test('saves the fetched font under its url filename and emits changed', async () => {
		const fetchMock = installBinaryFetchMock({ [url]: { bytes: 'FONTBYTES' } });
		const changes = countChanges(manager);

		const file = await manager.install(url);

		expect(file).toBe('Inter.ttf');
		expect(fsMock.writes).toEqual([
			{
				path: 'Unbound/Fonts/Inter.ttf',
				payload: Buffer.from('FONTBYTES').toString('base64'),
				encoding: 'base64',
			},
		]);
		expect(changes.count).toBe(1);

		fetchMock.restore();
	});

	test('FINDING: a url ending in a slash writes to the folder path with no filename', async () => {
		// `'…/'.split('/').pop()` yields `''`, which is not nullish, so the `font-${Date.now()}.ttf`
		// fallback never fires and the write targets the directory `Unbound/Fonts/` itself. Correct
		// behaviour would fall back on an empty segment, not just an absent one.
		const trailing = 'https://fonts.example/pack/';
		const fetchMock = installBinaryFetchMock({ [trailing]: { bytes: 'FONTBYTES' } });

		const file = await manager.install(trailing);

		expect(file).toBe('');
		expect(fsMock.writes[0]?.path).toBe('Unbound/Fonts/');

		fetchMock.restore();
	});

	test('a non-ok response writes nothing, emits nothing, and resolves undefined', async () => {
		const fetchMock = installBinaryFetchMock({ [url]: { ok: false, status: 404 } });
		const changes = countChanges(manager);

		expect(await manager.install(url)).toBeUndefined();
		expect(fsMock.writes).toEqual([]);
		expect(changes.count).toBe(0);

		fetchMock.restore();
	});

	test('a rejecting fetch is caught, writing nothing and emitting nothing', async () => {
		const fetchMock = installBinaryFetchMock({});
		const changes = countChanges(manager);

		expect(await manager.install(url)).toBeUndefined();
		expect(fsMock.writes).toEqual([]);
		expect(changes.count).toBe(0);

		fetchMock.restore();
	});
});
