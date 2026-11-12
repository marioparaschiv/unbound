import { describe, expect, test } from 'bun:test';

import { createPresenceSync } from '~/lib/sync';
import type { Activity } from '~/lib/types';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => (resolve = done));

	return { promise, resolve };
}

function activity(details: string): Activity {
	return { details } as Activity;
}

function setup(results: (() => Promise<Activity | null>)[]) {
	const sent: (Activity | null)[] = [];
	const timers: { callback: () => void; delay: number; cancelled: boolean }[] = [];
	let queries = 0;

	const sync = createPresenceSync({
		query: () => results[queries++]!(),
		dispatch: (value) => sent.push(value),
		schedule: (callback, delay) => {
			const timer = { callback, delay, cancelled: false };

			timers.push(timer);
			return () => void (timer.cancelled = true);
		},
		refreshDelay: 750,
	});

	return { sync, sent, timers, queries: () => queries };
}

describe('createPresenceSync', () => {
	test('sends only when the activity changes', async () => {
		const { sync, sent } = setup([
			async () => activity('a'),
			async () => activity('a'),
			async () => activity('b'),
			async () => null,
			async () => null,
		]);

		for (let poll = 0; poll < 5; poll++) await sync.poll();

		expect(sent).toEqual([activity('a'), activity('b'), null]);
	});

	test('skips a poll while one is running so a slow lookup still lands', async () => {
		const slow = deferred<Activity | null>();
		const { sync, sent, queries } = setup([() => slow.promise, async () => activity('late')]);

		const first = sync.poll();
		await sync.poll();
		await sync.poll();

		expect(queries()).toBe(1);

		slow.resolve(activity('slow'));
		await first;

		expect(sent).toEqual([activity('slow')]);
	});

	test('treats a failed query as no activity', async () => {
		const { sync, sent } = setup([
			async () => activity('a'),
			() => Promise.reject(new Error('offline')),
		]);

		await sync.poll();
		await sync.poll();

		expect(sent).toEqual([activity('a'), null]);
	});

	test('refreshes once after the delay, restarting it on each change', async () => {
		const { sync, sent, timers } = setup([async () => activity('fresh')]);

		sync.refresh();
		sync.refresh();

		expect(timers.map(({ delay, cancelled }) => [delay, cancelled])).toEqual([
			[750, true],
			[750, false],
		]);

		timers[1]!.callback();
		await Promise.resolve();
		await Promise.resolve();

		expect(sent).toEqual([activity('fresh')]);
	});

	test('drops a result read with old settings and reruns the poll', async () => {
		const slow = deferred<Activity | null>();
		const { sync, sent, timers, queries } = setup([
			() => slow.promise,
			async () => activity('new settings'),
		]);

		const first = sync.poll();

		sync.refresh();
		timers[0]!.callback();
		slow.resolve(activity('old settings'));
		await first;

		expect(queries()).toBe(2);
		expect(sent).toEqual([activity('new settings')]);
	});

	test('clears on stop only after an activity was sent', async () => {
		const empty = setup([async () => null]);

		await empty.sync.poll();
		empty.sync.stop();
		expect(empty.sent).toEqual([]);

		const untouched = setup([]);

		untouched.sync.stop();
		expect(untouched.sent).toEqual([]);

		const playing = setup([async () => activity('a')]);

		await playing.sync.poll();
		playing.sync.stop();
		expect(playing.sent).toEqual([activity('a'), null]);
	});

	test('drops results and refreshes after stop', async () => {
		const slow = deferred<Activity | null>();
		const { sync, sent, timers, queries } = setup([() => slow.promise]);

		const first = sync.poll();

		sync.refresh();
		sync.stop();
		slow.resolve(activity('a'));
		await first;
		await sync.poll();

		expect(timers[0]!.cancelled).toBe(true);
		expect(queries()).toBe(1);
		expect(sent).toEqual([]);
	});
});
