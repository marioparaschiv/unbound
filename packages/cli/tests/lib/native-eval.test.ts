import { describe, expect, test } from 'bun:test';

import { withNativeBridge } from '~/lib/native-eval';

describe('withNativeBridge', () => {
	test('binds native from the development bridge before the code, which stays last', () => {
		const wrapped = withNativeBridge('native.objc');

		expect(wrapped.startsWith('var native = ')).toBe(true);
		expect(wrapped).toContain('globalThis.__unboundDevNative()');
		expect(wrapped.endsWith('\nnative.objc')).toBe(true);
	});

	test('binds inspector from the development inspector when the build has one', () => {
		expect(withNativeBridge('inspector')).toContain(
			"var inspector = typeof globalThis.__unboundDevInspector === 'function'",
		);
	});

	test('explains a build without the development bridge', () => {
		expect(withNativeBridge('1')).toContain('no development native bridge');
	});
});
