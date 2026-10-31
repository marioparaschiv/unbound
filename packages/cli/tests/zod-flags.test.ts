import { describe, expect, test } from 'bun:test';
import { z } from 'zod';

import { fieldToFlag, isArrayField, negatedFlags } from '../src/lib/zod-flags';

test('maps array fields to repeatable string flags', () => {
	const field = z.array(z.string()).default([]);

	expect(isArrayField(field)).toBe(true);
	expect(fieldToFlag(field)).toEqual({ type: [String], description: undefined, default: [] });
});

test('keeps scalar fields as single-value flags', () => {
	const field = z.number().default(3).describe('rounds');

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
