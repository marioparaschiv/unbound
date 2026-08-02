import { describe, expect, test, mock, beforeEach } from 'bun:test';

// `themes.ts` builds a module-level singleton at import, which reaches storage for its settings
// store; the stubs must land before the dynamic import even for tests using a fresh instance.
const settings: Record<string, unknown> = {};
const writes: string[] = [];

mock.module('~/api/fs', () => ({
	default: {
		Documents: '/docs',
		write: async () => {},
		read: async () => '',
		rm: async () => true,
		exists: async () => false,
	},
}));

mock.module('~/api/native', () => ({
	BundleInfo: { Build: '1' },
	BundleManager: { reload: () => {} },
	DeviceInfo: {},
	getNativeModule: () => undefined,
}));

mock.module('~/api/storage', () => {
	const store = {
		get: (key: string, fallback: unknown) => (key in settings ? settings[key] : fallback),
		set: (key: string, value: unknown) => {
			settings[key] = value;
			writes.push(`set:${key}`);
		},
	};

	return {
		default: { getStore: () => store, get: (_s: string, _k: string, d: unknown) => d },
		getStore: () => store,
	};
});

import type { AddonManifest, Theme, ThemeEntity } from '@unbound-app/types';

import type { Themes as ThemesManager } from '~/managers/themes';
import ThemeStore from '~/stores/themes';

import { defineGlobal } from '../helpers/metro-fixture';
import { resetStore } from '../helpers/store-fixture';

const { Themes } = await import('~/managers/themes');

const resetThemes = resetStore(ThemeStore);

/** The shape `themes.initialize` walks off the host `window`. */
type ThemeBundleEntry = {
	manifest: AddonManifest;
	bundle: string;
};

function makeManifest(id: string): AddonManifest {
	return {
		id,
		name: id,
		description: 'test',
		authors: [{ name: 'Mario', id: '1' }],
		icon: '',
		updates: '',
		main: 'index.json',
		version: '1.0.0',
		folder: '',
		path: '',
		url: '',
	};
}

function makeTheme(type: Theme['type']): Theme {
	return {
		semantic: { BACKGROUND_PRIMARY: { type: 'color', value: '#000000' } },
		raw: { PRIMARY_500: '#111111' },
		type,
	};
}

function defineBundles(entries: ThemeBundleEntry[] | undefined) {
	defineGlobal('window', { UNBOUND_THEMES: entries });
}

/**
 * Seeds a theme directly into the manager, bypassing `load` so the started/instance pair can be set
 * to any combination the override's branches need.
 */
function seed(manager: ThemesManager, id: string, started: boolean): ThemeEntity {
	const entity: ThemeEntity = {
		id,
		data: makeManifest(id),
		bundle: JSON.stringify(makeTheme('midnight')),
		instance: started ? makeTheme('darker') : null,
		started,
		failed: false,
		registered: false,
	};

	manager.entities.set(id, entity);

	return entity;
}

let manager: ThemesManager;

beforeEach(() => {
	for (const key of Object.keys(settings)) delete settings[key];
	writes.length = 0;
	resetThemes();
	defineBundles([]);
	manager = new Themes();
});

describe('handleBundle parses the theme JSON', () => {
	test('a valid theme bundle becomes the instance verbatim', () => {
		const theme = makeTheme('light');
		settings['states'] = { valid: true };

		manager.load(JSON.stringify(theme), makeManifest('valid'));

		expect(manager.getEntity('valid')?.instance).toEqual(theme);
		expect(manager.getEntity('valid')?.started).toBe(true);
	});

	test('malformed JSON throws through start, recording the error and marking the theme failed', () => {
		const entity = seed(manager, 'malformed', false);
		entity.bundle = '{ "semantic": ';

		manager.start(entity);

		expect(manager.errors.get('malformed')).toBeInstanceOf(Error);
		expect(entity.failed).toBe(true);
		expect(entity.started).toBe(false);
		expect(entity.instance).toBeNull();
	});

	test('FINDING: a non-object JSON primitive is pushed onto the store as the applied theme', () => {
		// `handleBundle` is a bare `JSON.parse`, so `"42"` parses to a number and passes the `Theme`
		// contract unchecked all the way into `ThemeStore.data`, where every consumer reads
		// `.semantic`/`.raw` off it. Correct behaviour would reject a bundle that is not a theme object.
		const entity = seed(manager, 'primitive', false);
		entity.bundle = '42';

		manager.enable('primitive');

		expect(entity.instance).toBe(42);
		expect(ThemeStore.getState().data).toBe(entity.instance);
		expect(typeof ThemeStore.getState().data).toBe('number');
		expect(manager.errors.get('primitive')).toBeUndefined();
	});
});

describe('enable overrides the base to swap the applied theme', () => {
	test('with no theme previously applied the target is started and pushed to the store', () => {
		const entity = seed(manager, 'solo', false);

		let enabled: ThemeEntity | undefined;
		manager.on('enabled', (e) => void (enabled = e));

		manager.enable('solo');

		expect(settings['applied']).toBe('solo');
		expect(entity.started).toBe(true);
		expect(ThemeStore.getState().applied).toBe('solo');
		expect(ThemeStore.getState().data).toEqual(makeTheme('midnight'));
		expect(enabled?.id).toBe('solo');
	});

	test('a started previous theme is stopped before the applied setting is rewritten', () => {
		const previous = seed(manager, 'previous', true);
		seed(manager, 'next', false);
		settings['applied'] = 'previous';

		// The stop must land while `applied` still points at the outgoing theme, so a listener reading
		// the setting during teardown sees the theme being torn down rather than its replacement.
		const order: string[] = [];
		manager.on(
			'stopped',
			(e) => void order.push(`stopped:${e.id}:applied=${settings['applied']}`),
		);

		manager.enable('next');

		expect(previous.started).toBe(false);
		expect(previous.instance).toBeNull();
		expect(order).toEqual(['stopped:previous:applied=previous']);
		expect(writes).toEqual(['set:applied', 'set:states']);
		expect(settings['applied']).toBe('next');
	});

	test('a previous theme that was never started is left alone', () => {
		const previous = seed(manager, 'idle', false);
		seed(manager, 'incoming', false);
		settings['applied'] = 'idle';

		let stopped = false;
		manager.on('stopped', () => void (stopped = true));

		manager.enable('incoming');

		expect(stopped).toBe(false);
		expect(previous.started).toBe(false);
		expect(settings['applied']).toBe('incoming');
	});

	test('a previous id that is no longer loaded passes the guard without throwing', () => {
		seed(manager, 'fresh', false);
		settings['applied'] = 'unloaded-long-ago';

		expect(() => manager.enable('fresh')).not.toThrow();
		expect(settings['applied']).toBe('fresh');
		expect(manager.errors.get('fresh')).toBeUndefined();
	});

	test('re-enabling the already-applied theme does not stop and restart it', () => {
		const entity = seed(manager, 'current', true);
		settings['applied'] = 'current';
		const instance = entity.instance;

		let stopped = false;
		manager.on('stopped', () => void (stopped = true));

		manager.enable('current');

		expect(stopped).toBe(false);
		expect(entity.started).toBe(true);
		expect(entity.instance).toBe(instance);
		expect(ThemeStore.getState().data).toBe(instance);
	});

	test('an already-started theme skips start but still reaches the store', () => {
		const entity = seed(manager, 'running', true);

		let started = false;
		manager.on('started', () => void (started = true));

		manager.enable('running');

		expect(started).toBe(false);
		expect(ThemeStore.getState().applied).toBe('running');
		expect(ThemeStore.getState().data).toBe(entity.instance);
	});

	test('enable persists the enabled state alongside the applied id', () => {
		seed(manager, 'persisted', false);
		settings['states'] = { other: true };

		manager.enable('persisted');

		expect(settings['states']).toEqual({ other: true, persisted: true });
	});

	test('an unresolvable id is a no-op: no write, no event', () => {
		let fired = false;
		manager.on('enabled', () => void (fired = true));

		manager.enable('never-loaded');

		expect(fired).toBe(false);
		expect(writes).toEqual([]);
		expect(ThemeStore.getState().applied).toBeNull();
	});

	test('FINDING: a theme whose start fails is still recorded as applied with a null instance', () => {
		// `start()` swallows its own failure, so `enable` runs on to `setApplied(id, null)` and the
		// `applied` setting keeps pointing at a theme that never produced colours. Correct behaviour
		// would roll the swap back - or refuse it - when the incoming theme fails to start, since the
		// previous theme has already been stopped by this point and the user is left with neither.
		const previous = seed(manager, 'was-applied', true);
		const broken = seed(manager, 'broken', false);
		broken.bundle = 'not json at all';
		settings['applied'] = 'was-applied';

		manager.enable('broken');

		expect(manager.errors.get('broken')).toBeInstanceOf(Error);
		expect(broken.failed).toBe(true);
		expect(broken.started).toBe(false);
		expect(previous.started).toBe(false);
		expect(settings['applied']).toBe('broken');
		expect(ThemeStore.getState().applied).toBe('broken');
		expect(ThemeStore.getState().data).toBeNull();
	});
});

describe('disable overrides the base to clear the applied theme', () => {
	test('a started, applied theme is stopped and cleared from settings and the store', () => {
		const entity = seed(manager, 'active', true);
		settings['applied'] = 'active';
		settings['states'] = { active: true };
		ThemeStore.getState().setApplied('active', entity.instance);

		let disabled: ThemeEntity | undefined;
		manager.on('disabled', (e) => void (disabled = e));

		manager.disable('active');

		expect(settings['applied']).toBeNull();
		expect(settings['states']).toEqual({ active: false });
		expect(entity.started).toBe(false);
		expect(entity.instance).toBeNull();
		expect(ThemeStore.getState().applied).toBeNull();
		expect(ThemeStore.getState().data).toBeNull();
		expect(disabled?.id).toBe('active');
	});

	test('a stopped theme is cleared without a stop being attempted', () => {
		const entity = seed(manager, 'dormant', false);
		settings['applied'] = 'dormant';

		let stopped = false;
		manager.on('stopped', () => void (stopped = true));

		manager.disable('dormant');

		expect(stopped).toBe(false);
		expect(entity.started).toBe(false);
		expect(settings['applied']).toBeNull();
	});

	test('FINDING: disabling a non-applied theme unapplies whichever theme is actually applied', () => {
		// `disable` writes `applied: null` unconditionally, never checking that the target is the applied
		// theme. Disabling a background theme therefore strips the colours of the running one, which is
		// still started and still in `states`. Correct behaviour would only clear `applied` when
		// `settings.get('applied') === resolved.id`.
		const running = seed(manager, 'running', true);
		seed(manager, 'unrelated', false);
		settings['applied'] = 'running';
		ThemeStore.getState().setApplied('running', running.instance);

		manager.disable('unrelated');

		expect(running.started).toBe(true);
		expect(settings['applied']).toBeNull();
		expect(ThemeStore.getState().applied).toBeNull();
		expect(ThemeStore.getState().data).toBeNull();
	});

	test('an unresolvable id is a no-op: no write, no event', () => {
		settings['applied'] = 'untouched';

		let fired = false;
		manager.on('disabled', () => void (fired = true));

		manager.disable('never-loaded');

		expect(fired).toBe(false);
		expect(settings['applied']).toBe('untouched');
	});
});

describe('initialize walks the host bundle list', () => {
	test('every entry on UNBOUND_THEMES is loaded and the manager is marked initialised', () => {
		defineBundles([
			{ manifest: makeManifest('one'), bundle: JSON.stringify(makeTheme('light')) },
			{ manifest: makeManifest('two'), bundle: JSON.stringify(makeTheme('darker')) },
		]);

		manager.initialize();

		expect(manager.getEntities().map((e) => e.id)).toEqual(['one', 'two']);
		expect(manager.initialized).toBe(true);
	});

	test('an absent UNBOUND_THEMES falls back to an empty list rather than throwing', () => {
		defineBundles(undefined);

		expect(() => manager.initialize()).not.toThrow();
		expect(manager.getEntities()).toEqual([]);
		expect(manager.initialized).toBe(true);
	});

	test('a malformed manifest is recorded and the walk continues to later entries', () => {
		const broken = { id: 'broken' } as AddonManifest;

		defineBundles([
			{ manifest: broken, bundle: '{}' },
			{ manifest: makeManifest('after'), bundle: JSON.stringify(makeTheme('light')) },
		]);

		manager.initialize();

		expect(manager.errors.get('broken')).toBeInstanceOf(Error);
		expect(manager.getEntity('broken')).toBeUndefined();
		expect(manager.getEntity('after')).toBeDefined();
		expect(manager.initialized).toBe(true);
	});

	test('an entry enabled in states is parsed and started during initialize', () => {
		const theme = makeTheme('darker');
		settings['states'] = { enabled: true };

		defineBundles([
			{ manifest: makeManifest('enabled'), bundle: JSON.stringify(theme) },
			{ manifest: makeManifest('disabled'), bundle: JSON.stringify(makeTheme('light')) },
		]);

		manager.initialize();

		expect(manager.getEntity('enabled')?.started).toBe(true);
		expect(manager.getEntity('enabled')?.instance).toEqual(theme);
		expect(manager.getEntity('disabled')?.started).toBe(false);
	});
});
