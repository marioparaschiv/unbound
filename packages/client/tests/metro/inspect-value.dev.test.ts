import { describe, expect, test } from 'bun:test';

import { listChildren, previewValue } from '~/metro/inspect-value.dev';

describe('previewValue', () => {
	test('summarises primitives, arrays, maps and plain objects', () => {
		expect(previewValue('hi')).toEqual({ kind: 'string', text: '"hi"', expandable: false });
		expect(previewValue(3).text).toBe('3');
		expect(previewValue(null).kind).toBe('nullish');
		expect(previewValue([1, 2]).text).toBe('Array(2)');
		expect(previewValue(new Map([[1, 2]])).text).toBe('Map(1)');
		expect(previewValue({ a: 1 })).toEqual({
			kind: 'object',
			text: 'Object {…}',
			expandable: true,
		});
		expect(previewValue(Object.create(null)).text).toBe('[Object: null prototype] {…}');
	});

	test('names functions and tells class components apart', () => {
		class Component {}
		Object.assign(Component.prototype, { isReactComponent: {} });
		function plain() {}

		expect(previewValue(plain).text).toBe('ƒ plain()');
		expect(previewValue(Component)).toEqual({
			kind: 'class',
			text: 'class Component',
			expandable: true,
		});
	});

	test('names prototypes and Babel-transpiled classes', () => {
		function Store() {}
		Store.prototype.getState = function getState() {};

		expect(previewValue(Object.prototype).text).toBe('Object.prototype {…}');
		expect(previewValue(Store.prototype).text).toBe('Store.prototype {…}');
		expect(previewValue(Store).kind).toBe('class');
	});

	test('never runs a getter and survives a throwing proxy', () => {
		let ran = false;
		const value = {
			get trap() {
				ran = true;

				return 1;
			},
		};
		const hostile = new Proxy(
			{},
			{
				getPrototypeOf() {
					throw new Error('nope');
				},
			},
		);

		previewValue(value);
		expect(ran).toBe(false);
		expect(previewValue(hostile).kind).toBe('error');
	});
});

describe('listChildren', () => {
	test('lists one page of properties, then the prototype slot', () => {
		const children = listChildren([10, 20, 30], 1, 2);

		expect(children.properties.map((child) => child.key)).toEqual(['1', '2']);
		expect(children.total).toBe(4);
		expect(children.internal.map((child) => child.key)).toEqual(['[[Prototype]]']);
		expect(children.internal[0].read()).toBe(Array.prototype);
	});

	test('marks accessors as getters without running them', () => {
		let ran = 0;
		const value = {
			get lazy() {
				ran++;

				return 'loaded';
			},
		};
		const [child] = listChildren(value, 0, 10).properties;

		expect(child.getter).toBe(true);
		expect(ran).toBe(0);
		expect(child.read()).toBe('loaded');
	});

	test('adds an entries slot for maps and sets', () => {
		const children = listChildren(new Set(['a']), 0, 10);

		expect(children.internal.map((child) => child.key)).toEqual([
			'[[Entries]]',
			'[[Prototype]]',
		]);
		expect(children.internal[0].read()).toEqual(['a']);
	});
});
