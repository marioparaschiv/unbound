import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import vm from 'node:vm';

import { lower } from './downlevel';

const root = join(import.meta.dir, '..', '..', '..');

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
});
