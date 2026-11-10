import { expect, test } from 'bun:test';

import { waitFor } from '~/wait-for';

function clock() {
	let time = 0;

	return { now: () => time, sleep: async (ms: number) => void (time += ms) };
}

test('resolves true as soon as the condition holds', async () => {
	let checks = 0;
	const held = await waitFor(async () => ++checks === 3, {
		timeoutMs: 1_000,
		intervalMs: 100,
		...clock(),
	});

	expect(held).toBe(true);
	expect(checks).toBe(3);
});

test('resolves false once the time runs out, checking one last time at the deadline', async () => {
	let checks = 0;
	const held = await waitFor(
		async () => {
			checks++;

			return false;
		},
		{ timeoutMs: 300, intervalMs: 100, ...clock() },
	);

	expect(held).toBe(false);
	expect(checks).toBe(4);
});
