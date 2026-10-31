import { describe, expect, test } from 'bun:test';

import firstOf from './first-of';

describe('firstOf', () => {
	test('returns the first lookup that produces a value', () => {
		expect(
			firstOf(
				() => 'current',
				() => 'legacy',
			),
		).toBe('current');
	});

	test('falls through lookups that throw or produce nothing', () => {
		function missing(): never {
			throw new Error('missing');
		}

		expect(
			firstOf<[string, string, string, string]>(
				missing,
				() => null,
				() => undefined,
				() => 'legacy',
			),
		).toBe('legacy');
	});

	test('keeps falsy values that are not nullish', () => {
		expect(
			firstOf(
				() => 0,
				() => 1,
			),
		).toBe(0);
	});

	test('stops at the first value without running later lookups', () => {
		let later = 0;

		firstOf(
			() => 'current',
			() => {
				later++;

				return 'legacy';
			},
		);

		expect(later).toBe(0);
	});

	test('returns undefined when no lookup produces a value', () => {
		expect(firstOf(() => null)).toBeUndefined();
	});
});
