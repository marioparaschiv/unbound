import { describe, expect, test } from 'bun:test';

import { applyFeatures } from './apply-features';

describe('applyFeatures', () => {
	test('removes features in reverse order', () => {
		const calls: string[] = [];

		const dispose = applyFeatures('Test', [
			() => () => calls.push('a'),
			() => () => calls.push('b'),
		]);

		dispose();

		expect(calls).toEqual(['b', 'a']);
	});

	test('reverts applied features when a later one throws', () => {
		const calls: string[] = [];

		const dispose = applyFeatures('Test', [
			() => () => calls.push('a'),
			() => {
				throw new Error('missing');
			},
			() => () => calls.push('never'),
		]);

		expect(calls).toEqual(['a']);

		dispose();

		expect(calls).toEqual(['a']);
	});
});
