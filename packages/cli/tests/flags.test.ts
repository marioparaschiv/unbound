import { describe, expect, test } from 'bun:test';

import { fieldToFlag, isArrayField, negatedFlags } from '../src/lib/flags';
import { defaulted, Type } from '../src/lib/schema';

test('maps array fields to repeatable string flags', () => {
	const field = defaulted(Type.Array(Type.String()), []);

	expect(isArrayField(field)).toBe(true);
	expect(fieldToFlag(field)).toEqual({ type: [String], description: undefined, default: [] });
});

test('keeps scalar fields as single-value flags', () => {
	const field = defaulted(Type.Number({ description: 'rounds' }), 3);

	expect(isArrayField(field)).toBe(false);
	expect(fieldToFlag(field)).toEqual({ type: Number, description: 'rounds', default: 3 });
});

describe('negatedFlags', () => {
	test('turns --no-<flag> off for boolean flags and reports the rest', () => {
		expect(
			negatedFlags({ 'no-build': [true], 'no-dryRun': [true], buidl: [true] }, [
				'build',
				'dryRun',
			]),
		).toEqual({
			off: ['build', 'dryRun'],
			unmatched: ['buidl'],
		});
	});
});
