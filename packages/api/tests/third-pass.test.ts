import { describe, expect, test } from 'bun:test';

import { createFakeMetro, createFakeNative } from '../testing';

const manifest = { id: 'third-pass' } as never;

// A bridge with only the members a test gives, as `startPlugin({ native })` takes.
const own = (members: Record<string, () => unknown>) => members as never;

describe('metro.find', () => {
	test('serves a module registered after the lookup, for plain, any and all filters', () => {
		const metro = createFakeMetro();
		const { filters } = metro;
		const plain = metro.find(filters.byProps('later'));
		const either = metro.find(filters.any(filters.byProps('one'), filters.byProps('two')));
		const both = metro.find(filters.all(filters.byProps('a'), filters.byProps('b')));

		metro.register({ later: 1 });
		metro.register({ two: 2 });
		metro.register({ a: 3, b: 4 });

		expect(plain?.later).toBe(1);
		expect(either?.two).toBe(2);
		expect(both?.b).toBe(4);
	});

	test('finds the module now with lazy: false, and every match with all', () => {
		const metro = createFakeMetro();
		const module = { tag: 'x' };

		metro.register(module);

		expect(metro.find(metro.filters.byProps('tag'), { lazy: false })).toBe(module);
		expect(metro.find(metro.filters.byProps('none'), { lazy: false })).toBeUndefined();
		expect(metro.find(metro.filters.byProps('tag'), { all: true })).toEqual([module]);
	});
});

describe('native overrides', () => {
	test('merge into the fake objc bridge, so the fake members stay', () => {
		const native = createFakeNative();
		const snapshot = () => 'mine';

		native.objc.registerClass('UIView');

		const { objc } = native.context(manifest, {
			native: { objc: own({ snapshot }) },
		}).native;

		expect(Reflect.get(objc, 'snapshot')).toBe(snapshot as never);
		expect(objc.getClass('UIView')).toBeTruthy();
	});

	test('let an override win over the fake member of the same name', () => {
		const native = createFakeNative();

		native.objc.registerClass('UIView');

		const { objc } = native.context(manifest, {
			native: { objc: own({ getClass: () => 'mine' }) },
		}).native;

		expect(objc.getClass('UIView')).toBe('mine' as never);
	});

	test('merge into the java and hooks bridges on Android', () => {
		const native = createFakeNative();
		const hook = () => ({ id: 'mine' });

		native.state.platform = 'android';
		native.java.registerClass('a.B');

		const { java, hooks } = native.context(manifest, {
			native: { hooks: own({ hook }), java: own({ release: () => 'mine' }) },
		}).native;

		expect(hooks.hook).toBe(hook as never);
		expect(Reflect.get(hooks, 'remove')).toBeInstanceOf(Function);
		expect(java.describe('a.B').name).toBe('a.B');
		expect(Reflect.apply(java.release, java, [])).toBe('mine' as never);
	});
});

describe('native context', () => {
	test('gives each start its own bridge objects, so a plugin keeps nothing keyed by one across tests', () => {
		const native = createFakeNative();

		native.state.platform = 'android';

		const first = native.context(manifest).native;
		const second = native.context(manifest).native;

		expect(second.java).not.toBe(first.java);
		expect(second.hooks).not.toBe(first.hooks);
	});
});

describe('java.describe', () => {
	test('returns the parameter, return and field types a class declares', () => {
		const native = createFakeNative();

		native.java.registerClass('com.example.View', {
			methods: { bind: () => null, plain: () => null },
			staticMethods: { make: () => null },
			fields: { messageId: 'x' },
			staticFields: { TAG: 't' },
			signatures: {
				bind: { parameters: ['com.example.Message', 'int'], returnType: 'void' },
				make: { returnType: 'com.example.View' },
			},
			fieldTypes: { messageId: 'java.lang.String', TAG: 'java.lang.String' },
		});

		const description = native.java.bridge.describe('com.example.View');

		expect(description.methods).toEqual([
			{
				name: 'bind',
				parameters: ['com.example.Message', 'int'],
				returnType: 'void',
				static: false,
			},
			{ name: 'plain', parameters: [], returnType: 'java.lang.Object', static: false },
			{ name: 'make', parameters: [], returnType: 'com.example.View', static: true },
		]);
		expect(description.fields).toEqual([
			{ name: 'messageId', type: 'java.lang.String', static: false },
			{ name: 'TAG', type: 'java.lang.String', static: true },
		]);
	});
});
