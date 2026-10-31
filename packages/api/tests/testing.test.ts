import { afterEach, describe, expect, test } from 'bun:test';

import {
	createRecordingPatcher,
	installAddonGlobals,
	createMemoryStorage,
	createFakeMetro,
	createFakeReact,
} from '../testing';

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

	test('calls a Bucket listener for each change to that Bucket the predicate accepts', () => {
		const storage = createMemoryStorage();
		const bucket = storage.getBucket('plugin');
		const seen: (string | null)[] = [];
		const stop = bucket.addListener(
			({ key }) => key !== 'ignored',
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

	test('keeps other callers’ patches on a method when one tagged patcher unpatches', () => {
		const patcher = createRecordingPatcher();
		const tagged = patcher.createPatcher('plugin');
		const greeter = { greet: () => 'hi' };

		tagged.after(greeter, 'greet', ({ result }) => `${result}!`);
		patcher.after(greeter, 'greet', ({ result }) => `${result}?`);
		tagged.unpatchAll();

		expect(greeter.greet()).toBe('hi?');
	});

	test('removes only a tagged patcher’s patches with its unpatchAll', () => {
		const patcher = createRecordingPatcher();
		const tagged = patcher.createPatcher('plugin');
		const greeter = { greet: () => 'hi', wave: () => 'wave' };

		tagged.instead(greeter, 'greet', () => 'hello');
		patcher.instead(greeter, 'wave', () => 'bye');
		tagged.unpatchAll();

		expect(greeter.greet()).toBe('hi');
		expect(greeter.wave()).toBe('bye');
		expect(patcher.patches).toEqual([
			{ kind: 'instead', target: greeter, method: 'wave', caller: undefined },
		]);
	});
});

describe('createFakeMetro', () => {
	test('finds registered modules and settles a lazy wait when its module registers', async () => {
		const metro = createFakeMetro();
		const loaded: object[] = [];

		metro.onModuleLoad((module) => loaded.push(module));
		metro.register({ getUser: () => 'user' });

		const waiting = metro.findLazy(metro.filters.byFilePath('modules/typing.tsx'));
		const typing = { name: 'Typing' };

		metro.register(typing, 'modules/typing.tsx');

		expect(metro.findByProps('getUser', { lazy: true })).toEqual(loaded[0]);
		expect(metro.findByName('Typing')).toBe(typing);
		expect(await waiting).toBe(typing);
		expect(loaded).toHaveLength(2);
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
			hello: { description: 'Says hello.', execute: () => ({ content: 'hi' }) },
		});
		scope.storage.getBucket().set('enabled', true);

		expect(scope.logs).toEqual([{ level: 'warn', args: ['careful', 1] }]);
		expect([...scope.commands.registered.keys()]).toEqual(['hello']);
		expect(scope.unbound.storage.data.get('my-plugin')).toEqual({ enabled: true });

		scope.uninstall();

		expect('addon' in globalThis).toBe(false);
	});
});
