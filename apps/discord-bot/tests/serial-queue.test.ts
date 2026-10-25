import { describe, expect, test } from 'bun:test';

import createSerialQueue from '~/runtime/serial-queue';

describe('serial queue', () => {
	test('runs tasks one at a time in enqueue order, and a throwing task does not stall the next', async () => {
		const queue = createSerialQueue();
		const events: string[] = [];
		const slow = Promise.withResolvers<void>();

		const first = queue.enqueue(async () => {
			events.push('first started');
			await slow.promise;
			events.push('first done');
		});
		const failing = queue.enqueue(async () => {
			events.push('failing started');
			throw new Error('task failed');
		});
		const last = queue.enqueue(async () => {
			events.push('last ran');
		});

		await Bun.sleep(20);
		expect(events).toEqual(['first started']);

		slow.resolve();
		await first;
		await expect(failing).rejects.toThrow('task failed');
		await last;

		expect(events).toEqual(['first started', 'first done', 'failing started', 'last ran']);
	});

	test('drain resolves only after the task in flight settles', async () => {
		const queue = createSerialQueue();
		const slow = Promise.withResolvers<void>();
		let drained = false;

		void queue.enqueue(() => slow.promise);
		void queue.drain().then(() => {
			drained = true;
		});

		await Bun.sleep(20);
		expect(drained).toBe(false);

		slow.resolve();
		await queue.drain();
		expect(drained).toBe(true);
	});
});
