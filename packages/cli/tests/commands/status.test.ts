import { describe, expect, test } from 'bun:test';

import { analyzeSamples } from '~/commands/status';

const sample = (handles: number, hooks = 12) => ({ handles, hooks, surfaces: 1, cachedReturns: 0 });

describe('analyzeSamples', () => {
	test('flags a resource that rises in most intervals and ends clearly higher', () => {
		const { growing, lines } = analyzeSamples([
			sample(40),
			sample(70),
			sample(95),
			sample(90),
			sample(130),
		]);

		expect(growing).toEqual(['handles']);
		expect(lines[0]).toBe('handles: 40 → 130, rose in 3 of 4 intervals — growing steadily');
	});

	test('leaves noise and a single jump alone', () => {
		expect(
			analyzeSamples([sample(40), sample(44), sample(41), sample(45), sample(42)]).growing,
		).toEqual([]);
		expect(
			analyzeSamples([sample(40), sample(40), sample(40), sample(200), sample(200)]).growing,
		).toEqual([]);
	});

	test('counts a hook that keeps being added', () => {
		expect(analyzeSamples([sample(40, 12), sample(40, 13), sample(40, 14)]).growing).toEqual([
			'hooks',
		]);
	});
});
