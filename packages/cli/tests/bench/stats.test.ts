import { describe, expect, test } from 'bun:test';

import { mannWhitney, summarize } from '../src/bench/stats';
import { smallestP } from '../src/bench/report';

describe('summarize', () => {
	test('gives the median, range and interpolated quartiles', () => {
		expect(summarize([5, 1, 3])).toEqual({ n: 3, median: 3, min: 1, max: 5, q1: 2, q3: 4 });
	});

	test('averages the middle pair of an even sample', () => {
		expect(summarize([4, 1, 3, 2])?.median).toBe(2.5);
	});

	test('has nothing to say about no samples', () => {
		expect(summarize([])).toBeUndefined();
	});
});

describe('mannWhitney', () => {
	test('gives 2 / C(6, 3) for two fully separated samples of three', () => {
		expect(mannWhitney([1, 2, 3], [4, 5, 6])).toEqual({ u: 0, p: 0.1 });
	});

	test('gives 2 / C(10, 5) for two fully separated samples of five', () => {
		expect(mannWhitney([6, 7, 8, 9, 10], [1, 2, 3, 4, 5])?.p).toBeCloseTo(2 / 252, 12);
		expect(mannWhitney([6, 7, 8, 9, 10], [1, 2, 3, 4, 5])?.u).toBe(25);
	});

	test('finds no difference between identical samples', () => {
		expect(mannWhitney([5, 5, 5], [5, 5, 5])?.p).toBe(1);
	});

	test('gives the same p either way round, with the two U values summing to n1 n2', () => {
		const a = [312, 330, 330, 351, 298];
		const b = [330, 340, 362, 371];
		const ab = mannWhitney(a, b)!;
		const ba = mannWhitney(b, a)!;

		expect(ab.p).toBeCloseTo(ba.p, 12);
		expect(ab.u + ba.u).toBe(a.length * b.length);
	});

	test('cannot test an empty sample', () => {
		expect(mannWhitney([], [1])).toBeUndefined();
	});
});

describe('smallestP', () => {
	test('is the two extreme splits over every split', () => {
		expect(smallestP(3, 3)).toBe(0.1);
		expect(smallestP(5, 5)).toBeCloseTo(2 / 252, 12);
	});
});
