import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test';

import { startCountdown } from '~/lib/countdown';

describe('startCountdown', () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	test('reports each second left, then finishes', () => {
		const ticks: number[] = [];
		let done = false;

		startCountdown({
			seconds: 3,
			onTick: (left) => ticks.push(left),
			onDone: () => (done = true),
		});
		jest.advanceTimersByTime(3000);

		expect(ticks).toEqual([3, 2, 1]);
		expect(done).toBe(true);
	});

	test('never finishes once cancelled', () => {
		let done = false;
		const countdown = startCountdown({
			seconds: 2,
			onTick: () => {},
			onDone: () => (done = true),
		});

		jest.advanceTimersByTime(1000);
		countdown.cancel();
		jest.advanceTimersByTime(5000);

		expect(done).toBe(false);
	});

	test.each([undefined, Number.NaN, 0, -1])('finishes at once for a count of %p', (seconds) => {
		const ticks: number[] = [];
		let done = false;

		startCountdown({
			seconds: seconds as number,
			onTick: (left) => ticks.push(left),
			onDone: () => (done = true),
		});

		expect(ticks).toEqual([]);
		expect(done).toBe(true);
	});
});
