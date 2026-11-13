import { describe, expect, test } from 'bun:test';

const { retryUntilInstalled } = await import('~/native/hook-retry');

function manualClock() {
	const queue: { callback: () => void; delay: number }[] = [];

	return {
		queue,
		schedule: (callback: () => void, delay: number) => {
			queue.push({ callback, delay });

			return setTimeout(() => undefined, 0);
		},
		run() {
			queue.shift()?.callback();
		},
	};
}

describe('hook retries', () => {
	test('backs off until the attempt succeeds', () => {
		const clock = manualClock();
		let attempts = 0;

		retryUntilInstalled(
			() => ++attempts === 3,
			clock.schedule,
			() => undefined,
		);

		clock.run();
		clock.run();
		clock.run();

		expect(attempts).toBe(3);
		expect(clock.queue).toHaveLength(0);
	});

	test('stops once cancelled', () => {
		const clock = manualClock();
		let attempts = 0;
		const retry = retryUntilInstalled(
			() => {
				attempts++;

				return false;
			},
			clock.schedule,
			() => undefined,
		);

		retry.cancel();
		clock.run();

		expect(attempts).toBe(0);
	});
});
