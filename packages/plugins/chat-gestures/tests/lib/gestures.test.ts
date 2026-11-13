import { describe, expect, test } from 'bun:test';

import { createTapCounter, reactionEmoji } from '~/lib/gestures';

function manualClock() {
	const timers = new Map<number, () => void>();
	let next = 0;

	return {
		schedule: (run: () => void) => {
			next += 1;
			timers.set(next, run);

			return next as unknown as ReturnType<typeof setTimeout>;
		},
		cancel: (timer: ReturnType<typeof setTimeout>) =>
			void timers.delete(timer as unknown as number),
		flush: () => {
			for (const [id, run] of [...timers]) {
				timers.delete(id);
				run();
			}
		},
	};
}

describe('tap counter', () => {
	test('runs a double tap at once when no triple tap is set', () => {
		const clock = manualClock();
		const taps = createTapCounter(clock.schedule, clock.cancel);
		const runs: string[] = [];

		taps.doubleTap('1', false, () => runs.push('double'));

		expect(runs).toEqual(['double']);
	});

	test('turns a double tap and a tap on the same message into a triple tap', () => {
		const clock = manualClock();
		const taps = createTapCounter(clock.schedule, clock.cancel);
		const runs: string[] = [];

		taps.doubleTap('1', true, () => runs.push('double'));

		expect(taps.tap('1')).toBe(true);
		clock.flush();
		expect(runs).toEqual([]);
	});

	test('runs the double tap once the wait passes, and leaves taps on other messages alone', () => {
		const clock = manualClock();
		const taps = createTapCounter(clock.schedule, clock.cancel);
		const runs: string[] = [];

		taps.doubleTap('1', true, () => runs.push('double'));

		expect(taps.tap('2')).toBe(false);
		clock.flush();
		expect(runs).toEqual(['double']);
		expect(taps.tap('1')).toBe(false);
	});
});

describe('reaction emoji', () => {
	test('reads unicode and custom emojis', () => {
		expect(reactionEmoji(' 👍 ')).toBe('👍');
		expect(reactionEmoji('<:socute:1373930998265286727>')).toBe('socute:1373930998265286727');
		expect(reactionEmoji('<a:siren~1:669518972407775265>')).toBe('siren~1:669518972407775265');
		expect(reactionEmoji('')).toBeUndefined();
	});
});
