import { afterEach, describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';

import {
	createRecordingPatcher,
	installAddonGlobals,
	createMemoryStorage,
	createListenerRegistry,
	createFakeSettings,
	createFakeMetro,
	createFakeReact,
	createFakeFlux,
	createFakeTimers,
	defineSettings,
	setting,
} from '../testing';

type LabelProps = { text: string };

describe('createMemoryStorage', () => {
	test('keeps nested settings per Bucket and serves the default Bucket without a name', () => {
		const storage = createMemoryStorage('my-plugin');
		const bucket = storage.getBucket();

		bucket.set('colors.accent', 'red');
		bucket.toggle('enabled', false);
		storage.getBucket('other').set('enabled', false);

		expect(bucket.get('colors.accent', 'blue')).toBe('red');
		expect(bucket.get('enabled', false)).toBe(true);
		expect(bucket.get('missing', 3)).toBe(3);
		expect(storage.data.get('my-plugin')).toEqual({ colors: { accent: 'red' }, enabled: true });

		bucket.remove('colors.accent');
		expect(bucket.get('colors.accent', 'blue')).toBe('blue');

		bucket.clear();
		expect(storage.data.has('my-plugin')).toBe(false);
		expect(storage.getBucket('other').get('enabled', true)).toBe(false);
	});

	test('calls an onChange listener for each change the predicate accepts', () => {
		const storage = createMemoryStorage();
		const bucket = storage.getBucket('plugin');
		const seen: (string | null)[] = [];
		const stop = storage.onChange(
			({ store, key }) => store === 'plugin' && key !== 'ignored',
			({ key }) => seen.push(key),
		);

		bucket.set('enabled', true);
		bucket.set('ignored', true);
		bucket.toggle('enabled', false);
		storage.getBucket('other').set('enabled', true);
		bucket.remove('enabled');
		bucket.clear();
		stop();
		bucket.set('enabled', true);

		expect(seen).toEqual(['enabled', 'enabled', 'enabled', null]);
	});

	test('prunes the objects a remove leaves empty, and the Bucket with them', () => {
		const storage = createMemoryStorage();
		const bucket = storage.getBucket('plugin');

		bucket.set('a.b.c', 1);
		bucket.set('a.d', 2);
		bucket.remove('a.b.c');
		expect(storage.data.get('plugin')).toEqual({ a: { d: 2 } });

		bucket.remove('a.d');
		expect(storage.data.has('plugin')).toBe(false);
	});

	test('returns a stored null instead of the default', () => {
		const bucket = createMemoryStorage().getBucket('plugin');

		bucket.set('value', null);

		expect(bucket.get('value', 'default')).toBeNull();
	});

	test('throws when a set passes through a value that is not an object', () => {
		const storage = createMemoryStorage();
		const bucket = storage.getBucket('plugin');

		bucket.set('a', 1);

		expect(() => bucket.set('a.b', 2)).toThrow(TypeError);
		expect(storage.data.get('plugin')).toEqual({ a: 1 });
	});
});

describe('createRecordingPatcher', () => {
	test('patches for real, records each patch, and restores the method on unpatch', () => {
		const patcher = createRecordingPatcher();
		const math = { double: (value: number) => value * 2 };
		const original = math.double;

		const unbefore = patcher.before(math, 'double', ({ args }) => [args[0] + 1]);
		const unafter = patcher.after(math, 'double', ({ result }) => result * 10);

		expect(math.double(1)).toBe(40);
		expect(patcher.patches.map((patch) => patch.kind)).toEqual(['before', 'after']);

		unafter();
		unbefore();

		expect(math.double).toBe(original);
		expect(patcher.patches).toEqual([]);
	});

	test('keeps the rest of a stack when its patches are removed in any order', () => {
		const patcher = createRecordingPatcher();
		const counter = { value: () => 1 };
		const original = counter.value;

		const untimes = patcher.after(counter, 'value', ({ result }) => result * 10);
		const unplus = patcher.after(counter, 'value', ({ result }) => result + 1);

		expect(counter.value()).toBe(11);

		untimes();
		expect(counter.value()).toBe(2);

		unplus();
		expect(counter.value()).toBe(1);
		expect(counter.value).toBe(original);
	});

	test('removes every patch with unpatchAll and restores each method', () => {
		const patcher = createRecordingPatcher();
		const greeter = { greet: () => 'hi', wave: () => 'wave' };

		patcher.instead(greeter, 'greet', () => 'hello');
		patcher.after(greeter, 'wave', ({ result }) => `${result}!`);
		patcher.unpatchAll();

		expect(greeter.greet()).toBe('hi');
		expect(greeter.wave()).toBe('wave');
		expect(patcher.patches).toEqual([]);
	});

	test('patches the render inside a memo with patcher.react, typed props in, tree out', () => {
		const patcher = createRecordingPatcher();
		const Label = {
			$$typeof: Symbol.for('react.memo'),
			type: (props: LabelProps): ReactNode => props.text,
		};
		const module = { default: Label };

		patcher.react.before(module, 'default', ({ props }) => ({
			text: props.text.toUpperCase(),
		}));
		patcher.react.after(module, 'default', ({ result }) => [result, '!']);

		expect(Label.type({ text: 'hi' })).toEqual(['HI', '!']);
		expect(patcher.patches).toMatchObject([
			{ kind: 'before', target: Label, method: 'type' },
			{ kind: 'after', target: Label, method: 'type' },
		]);

		patcher.unpatchAll();
		expect(Label.type({ text: 'hi' })).toBe('hi');
	});
});

describe('createFakeMetro', () => {
	test('rejects a file-path filter inside a combination, as the client does', () => {
		const { filters } = createFakeMetro();
		const path = filters.byFilePath('modules/Sticker.tsx');

		expect(() => filters.any(path, filters.byName('Sticker'))).toThrow(
			/cannot take a raw filter/,
		);
		expect(() => filters.all(path)).toThrow(/cannot take a raw filter/);
		expect(() => filters.not(path)).toThrow(/cannot take a raw filter/);
	});

	test('finds registered modules and settles a lazy wait when its module registers', async () => {
		const metro = createFakeMetro();
		const loaded: object[] = [];

		metro.onModuleLoad((module) => loaded.push(module));
		metro.register({ getUser: () => 'user' });

		const waiting = metro.findLazy(metro.filters.byFilePath('modules/typing.tsx'));
		const typing = { name: 'Typing' };

		metro.register(typing, 'modules/typing.tsx');

		expect(metro.findByProps('getUser', { lazy: true })).toEqual(loaded[0]);
		expect(metro.findByName('Typing', { lazy: false })).toBe(typing);
		expect(await waiting).toBe(typing);
		expect(loaded).toHaveLength(2);
	});

	test('serves a lookup made before its module registers, as a lazy handle does on device', () => {
		const metro = createFakeMetro();
		const Container = metro.findByFilePath('modules/Container.tsx');
		const { Theme } = metro.common;

		if (!Container) {
			throw new Error('A lazy lookup always returns a handle.');
		}

		expect(metro.getModulePresence(Container)).toBe('missing');
		expect(() => Reflect.set(Container, 'default', null)).toThrow(/Call metro.register\(\)/);

		metro.register({ default: 'container' }, 'modules/Container.tsx');
		metro.register({ colors: { RED_400: '#f00' }, internal: {} });

		expect(Container.default).toBe('container');
		expect(Theme.colors.RED_400).toBe('#f00');
		expect(metro.getModulePresence(Container)).toBe('loaded');
		expect(metro.getModulePresence({})).toBeUndefined();
	});

	test('resolves an aborted wait with undefined', async () => {
		const metro = createFakeMetro();
		const controller = new AbortController();
		const waiting = metro.findLazy(metro.filters.byProps('never'), {
			signal: controller.signal,
		});

		controller.abort();

		expect(await waiting).toBeUndefined();
	});
});

describe('createFakeReact', () => {
	test('builds plain elements and runs hooks as on a first render', () => {
		const React = createFakeReact();
		const [count] = React.useState(() => 3);

		expect(React.createElement('Text', { bold: true }, 'hi', count)).toEqual({
			type: 'Text',
			props: { bold: true, children: ['hi', 3] },
		});
		expect(React.useMemo(() => count * 2)).toBe(6);
		expect(React.useRef(1).current).toBe(1);
	});
});

describe('installAddonGlobals', () => {
	let uninstall = () => {};

	afterEach(() => uninstall());

	test('installs the Addon scope on globalThis and restores it on uninstall', () => {
		const assets = { getIDByName: () => 42 };
		const scope = installAddonGlobals({ manifest: { id: 'my-plugin' }, unbound: { assets } });

		uninstall = scope.uninstall;

		expect(Reflect.get(globalThis, 'addon').id).toBe('my-plugin');
		expect(Reflect.get(globalThis, 'unbound').assets).toBe(assets);

		scope.logger.warn('careful', 1);
		scope.commands.register({
			hello: { description: 'COIN_FLIP', execute: () => ({ content: 'hi' }) },
		});
		scope.storage.getBucket().set('enabled', true);

		expect(scope.logs).toEqual([{ level: 'warn', args: ['careful', 1] }]);
		expect([...scope.commands.registered.keys()]).toEqual(['hello']);
		expect(scope.unbound.storage.data.get('my-plugin')).toEqual({ enabled: true });

		scope.uninstall();

		expect('addon' in globalThis).toBe(false);
	});
});

describe('setting.button', () => {
	test('builds the button the client builds, which stores nothing', () => {
		const storage = createMemoryStorage('my-plugin');
		const schema = defineSettings({
			enabled: setting.boolean({ default: true, title: 'ENABLED' }),
			clear: setting.button({ title: 'CLEAR', action: 'clear', confirm: 'CLEAR_CONFIRM' }),
		});
		const settings = createFakeSettings(schema, storage, 'my-plugin');

		expect(schema.properties.clear).toEqual({
			kind: 'button',
			displayAs: 'button',
			title: 'CLEAR',
			action: 'clear',
			confirm: 'CLEAR_CONFIRM',
		});
		expect(settings.settings.enabled).toBe(true);
		expect(() => settings.set('clear', true)).toThrow(/not in the schema/);
		expect(Object.keys(settings.settings)).toEqual(['enabled']);
	});
});

describe('setting.notice', () => {
	test('builds the notice the CLI builds, which stores nothing', () => {
		const schema = defineSettings({
			enabled: setting.boolean({ default: true, title: 'ENABLED' }),
			note: setting.notice({ title: 'NOTE', tone: 'danger', visibleWhen: 'enabled' }),
			plain: setting.notice({ title: 'PLAIN' }),
		});
		const settings = createFakeSettings(schema, createMemoryStorage('my-plugin'), 'my-plugin');

		expect(schema.properties.note).toEqual({
			kind: 'notice',
			displayAs: 'notice',
			title: 'NOTE',
			tone: 'danger',
			visibleWhen: 'enabled',
		});
		expect(schema.properties.plain?.tone).toBe('info');
		expect(() => settings.set('note', true)).toThrow(/not in the schema/);
		expect(Object.keys(settings.settings)).toEqual(['enabled']);
	});
});

describe('createFakeMetro', () => {
	test('finds every match with all, and finds by type name and the API props', () => {
		const metro = createFakeMetro();
		const first = { tag: 'x' };
		const second = { tag: 'x', type: { name: 'Chat' } };

		metro.register(first);
		metro.register(second);
		metro.register({ sendMessage: () => 'sent', receiveMessage: () => 'received' });

		expect(metro.find(metro.filters.byProps('tag'), { all: true })).toEqual([first, second]);
		expect(metro.find(metro.filters.byTypeName('Chat'), { lazy: false })).toBe(second);
		expect(metro.api.Messages.sendMessage()).toBe('sent');
		expect(metro.findByProps('tag', { all: true })).toEqual([first, second]);
	});

	test('forgets its modules and waits on reset, and a handle made before finds the next ones', () => {
		const metro = createFakeMetro();
		const handle = metro.findByProps('late');
		let loaded = 0;

		metro.register({ late: 1 });
		metro.onModuleLoaded(metro.filters.byProps('never'), () => void loaded++);
		metro.reset();
		metro.register({ never: true });

		expect(loaded).toBe(0);
		expect(handle?.late).toBeUndefined();

		metro.register({ late: 2 });

		expect(handle?.late).toBe(2);
	});
});

describe('createFakeFlux', () => {
	test('serves a patch made through getStore in later reads', () => {
		const flux = createFakeFlux(createListenerRegistry());
		const patcher = createRecordingPatcher();

		flux.seed({ User: { getCurrentUser: () => 'wumpus' } });
		patcher.after(flux.getStore('User'), 'getCurrentUser', () => 'patched');

		expect(flux.getStore('User').getCurrentUser()).toBe('patched');

		patcher.unpatchAll();

		expect(flux.getStore('User').getCurrentUser()).toBe('wumpus');
	});

	test('lists a change listener added directly, not one the kit adds for a hook or onStoreChange', () => {
		const flux = createFakeFlux(createListenerRegistry());

		flux.seed({ User: {} });
		flux.onStoreChange(flux.getStore('User'), () => {});

		expect(flux.directListeners()).toEqual([]);

		flux.getStore('User').addChangeListener(() => {});

		expect(flux.directListeners()).toEqual(['UserStore.addChangeListener']);
	});
});

describe('createFakeTimers', () => {
	test('runs timers for real and clears what is pending', async () => {
		const timers = createFakeTimers();
		let fired = 0;
		const first = Promise.withResolvers<void>();

		timers.setTimeout(() => {
			fired++;
			first.resolve();
		}, 1);
		timers.setTimeout(() => void fired++, 60_000);
		timers.setInterval(() => void fired++, 1_000);

		expect(timers.pending()).toBe(3);

		await first.promise;

		expect(fired).toBe(1);
		expect(timers.pending()).toBe(2);

		timers.clearAll();
		await Bun.sleep(8);

		expect(fired).toBe(1);
		expect(timers.pending()).toBe(0);
	});
});
