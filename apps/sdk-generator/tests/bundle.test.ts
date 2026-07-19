import { describe, expect, test } from 'bun:test';

import { resolveLibraryTypes } from '../src/bundle';

describe('resolveLibraryTypes', () => {
	test('resolves a types-field package (tseep)', () => {
		expect(resolveLibraryTypes('tseep')).toEndWith('tseep/lib/index.d.ts');
	});

	test('resolves a string root export (@unbound-app/logger)', () => {
		expect(resolveLibraryTypes('@unbound-app/logger')).toEndWith('logger/src/index.ts');
	});

	test('resolves an exports types condition (possess)', () => {
		expect(resolveLibraryTypes('possess')).toEndWith('possess/dist/index.d.mts');
	});

	test('returns undefined for a package without a typings entry (@unbound-app/utils)', () => {
		expect(resolveLibraryTypes('@unbound-app/utils')).toBeUndefined();
	});

	test('returns undefined for a package that is not installed', () => {
		expect(resolveLibraryTypes('definitely-not-installed-here')).toBeUndefined();
	});
});
