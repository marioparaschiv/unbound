import { describe, expect, test } from 'bun:test';

Object.assign(globalThis, { $$DEV$$: false });

const { CACHE_KEY } = await import('~/core/constants');
const { byTypeName } = await import('~/metro/filters');

describe('byTypeName', () => {
	test('matches a memo component by its inner type name', () => {
		const filter = byTypeName('MediaKeyboardBottomSheetActions');

		expect(filter({ type: function MediaKeyboardBottomSheetActions() {} }, 0)).toBe(true);
		expect(filter({ type: function OtherActions() {} }, 0)).toBe(false);
		expect(filter({}, 0)).toBe(false);
	});

	test('carries a cache key, so a miss is remembered', () => {
		expect(byTypeName('Actions')[CACHE_KEY]).toBe('byTypeName::Actions');
	});
});
