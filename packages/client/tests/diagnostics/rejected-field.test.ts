import { describe, expect, test } from 'bun:test';

import { rejectedField, withoutRejectedField } from '~/diagnostics/rejected-field';

const required = new Set(['client']);

describe('rejectedField', () => {
	test('reads the top-level field from a nested path', () => {
		expect(rejectedField('must not have more than 8 characters (at /clock/utcOffset)')).toBe(
			'clock',
		);
	});

	test('reads a top-level path', () => {
		expect(rejectedField('must not have additional properties (at /isolatedExtensions)')).toBe(
			'isolatedExtensions',
		);
	});

	test('returns undefined without a path', () => {
		expect(rejectedField('Internal error')).toBeUndefined();
	});
});

describe('withoutRejectedField', () => {
	test('drops the rejected optional field', () => {
		const body: { client: string; clock?: { utcOffset: string } } = {
			client: 'v3',
			clock: { utcOffset: 'UTC+01:00' },
		};

		expect(withoutRejectedField(body, 'too long (at /clock/utcOffset)', required)).toEqual({
			client: 'v3',
		});
	});

	test('keeps required fields', () => {
		expect(
			withoutRejectedField({ client: 'v3' }, 'too long (at /client)', required),
		).toBeUndefined();
	});

	test('gives up when the field is already gone', () => {
		expect(withoutRejectedField({ client: 'v3' }, 'bad (at /clock)', required)).toBeUndefined();
	});
});
