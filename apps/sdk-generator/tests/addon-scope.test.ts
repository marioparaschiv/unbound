import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { addonScopeGlobals, readScopeGlobalNames } from '../src/addon-scope';

describe('addonScopeGlobals', () => {
	test('types every global the client evaluates a plugin with, in parameter order', () => {
		expect(addonScopeGlobals().map(([name]) => name)).toEqual(readScopeGlobalNames());
	});

	test('fails generation for a global with no SDK type', () => {
		expect(() =>
			addonScopeGlobals(join(import.meta.dirname, 'fixtures', 'scope-globals.ts')),
		).toThrow('Untyped: [toasts]');
	});
});
