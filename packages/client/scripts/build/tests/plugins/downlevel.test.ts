import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import vm from 'node:vm';

import { GLOBAL_BANNER, lower, lowerScript } from '../../plugins/downlevel';

const root = join(import.meta.dir, '..', '..', '..', '..');

describe('lower', () => {
	test('keeps swc helpers off the global object when run by indirect eval', () => {
		const context = vm.createContext({});
		const before = Object.getOwnPropertyNames(vm.runInContext('globalThis', context));

		vm.runInContext(
			lower(root, 'globalThis.probe = class { #x = 1; async *f() { yield this.#x; } };').code,
			context,
		);

		const added = Object.getOwnPropertyNames(vm.runInContext('globalThis', context)).filter(
			(name) => !before.includes(name),
		);

		expect(added).toEqual(['probe']);
	});

	test('leaves loop bindings and async generators to hermesc in bytecode, and lowers them for source', () => {
		const code =
			'globalThis.fns = []; for (let i = 0; i < 3; i++) fns.push(() => i); async function* g() {}';
		const bytecode = lower(root, code, false, 'bytecode').code;

		expect(bytecode).toContain('let i');
		expect(bytecode).toContain('async function*');

		const context = vm.createContext({});

		vm.runInContext(lower(root, code, false, 'source').code, context);

		expect(vm.runInContext('fns.map((f) => f())', context)).toEqual([0, 1, 2]);
	});
});

describe('lowerScript', () => {
	test('lowers the shipped script for a Hermes without the feature flags, keeping helpers off the global object', () => {
		// A `return` inside the loop makes swc add its `_type_of` helper.
		const { code } = lowerScript(
			`${GLOBAL_BANNER}(() => { globalThis.out = []; (() => { for (let i = 0; i < 3; i++) { out.push(() => i); if (i > 5) return i; } })(); })();`,
		);
		const context = vm.createContext({});
		const before = Object.getOwnPropertyNames(vm.runInContext('globalThis', context));

		vm.runInContext(code, context);

		const added = Object.getOwnPropertyNames(vm.runInContext('globalThis', context)).filter(
			(name) => !before.includes(name),
		);

		expect(code).toContain('_type_of');
		expect(added.toSorted()).toEqual(['global', 'out']);
		expect(vm.runInContext('out.map((f) => f())', context)).toEqual([0, 1, 2]);
	});
});
