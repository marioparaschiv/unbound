import { describe, expect, test } from 'bun:test';

import { averageSpeed, createSpeedTracker, recordSpeed } from '~/lib/speed';

describe('typing speed', () => {
	test('measures words per minute while the draft grows', () => {
		const tracker = createSpeedTracker();

		tracker.update({ length: 1, at: 0 });
		expect(tracker.update({ length: 10, at: 1000 })).toBeUndefined();
		expect(tracker.update({ length: 50, at: 6000 })).toBe(100);
		expect(tracker.finish()).toBe(100);
	});

	test('leaves idle time out', () => {
		const tracker = createSpeedTracker();

		tracker.update({ length: 1, at: 0 });
		tracker.update({ length: 25, at: 3000 });
		expect(tracker.update({ length: 50, at: 63_000 })).toBe(Math.round(10 / (13_000 / 60_000)));
	});

	test('starts again once the draft empties', () => {
		const tracker = createSpeedTracker();

		tracker.update({ length: 40, at: 0 });
		tracker.update({ length: 0, at: 500 });
		tracker.update({ length: 1, at: 10_000 });
		expect(tracker.update({ length: 30, at: 13_000 })).toBe(120);
	});

	test('keeps the average and best', () => {
		const stats = recordSpeed(recordSpeed({ messages: 0, totalWpm: 0, bestWpm: 0 }, 40), 80);

		expect(stats).toEqual({ messages: 2, totalWpm: 120, bestWpm: 80 });
		expect(averageSpeed(stats)).toBe(60);
		expect(averageSpeed({ messages: 0, totalWpm: 0, bestWpm: 0 })).toBeUndefined();
	});
});
