import { describe, expect, mock, test } from 'bun:test';

mock.module('@unbound-app/api', () => ({}));

const { ensureModules } = await import('./ensure-modules');

function lazy(module: { value: number } | undefined) {
	return new Proxy(
		{ __METRO_LAZY__: true, module },
		{ get: (target, prop) => (prop === 'module' ? target.module : undefined) },
	);
}

describe('ensureModules', () => {
	test('accepts a native module that answers `in` for every name', () => {
		const native = new Proxy({}, { has: () => true, get: () => undefined });

		expect(ensureModules('Test', { native })).toBe(true);
	});

	test('accepts a lazy handle only once it resolves', () => {
		expect(ensureModules('Test', { found: lazy({ value: 1 }) })).toBe(true);
		expect(ensureModules('Test', { missing: lazy(undefined) })).toBe(false);
	});

	test('rejects missing handles', () => {
		expect(ensureModules('Test', { missing: undefined })).toBe(false);
	});
});
