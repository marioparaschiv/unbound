import { describe, expect, test } from 'bun:test';

import { createFrameGate } from '~/lib/frame-gate';

function frames() {
	const queued: (() => void)[] = [];

	return {
		nextFrame: (run: () => void) => {
			queued.push(run);
		},
		async advance() {
			queued.splice(0).forEach((run) => run());
			await Promise.resolve();
		},
		get pending() {
			return queued.length;
		},
	};
}

async function passed(gate: () => Promise<void>, count: number) {
	const order: number[] = [];

	for (let index = 0; index < count; index++) void gate().then(() => order.push(index));

	await Promise.resolve();

	return order;
}

describe('frame gate', () => {
	test('lets only the per-frame number through in one frame', async () => {
		const clock = frames();
		const order = await passed(createFrameGate(2, clock.nextFrame), 5);

		expect(order).toEqual([0, 1]);
	});

	test('lets the waiting callers through on later frames, in order', async () => {
		const clock = frames();
		const order = await passed(createFrameGate(2, clock.nextFrame), 5);

		await clock.advance();
		expect(order).toEqual([0, 1, 2, 3]);

		await clock.advance();
		expect(order).toEqual([0, 1, 2, 3, 4]);
	});

	test('stops asking for frames once nobody waits', async () => {
		const clock = frames();
		const gate = createFrameGate(2, clock.nextFrame);

		await passed(gate, 1);
		await clock.advance();

		expect(clock.pending).toBe(0);
		expect(await passed(gate, 2)).toEqual([0, 1]);
	});
});
