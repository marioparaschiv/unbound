import { expect, test } from 'bun:test';

import { createScopedTimers } from '~/addons/timers';

function wait(ms: number) {
	return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

test('hands a throwing timeout to onError instead of throwing it', async () => {
	const errors: unknown[] = [];
	const timers = createScopedTimers((error) => errors.push(error));
	const boom = new Error('boom');

	timers.setTimeout(() => {
		throw boom;
	}, 0);
	await wait(5);

	expect(errors).toEqual([boom]);
	timers.dispose();
});

test('keeps an interval running after its callback throws', async () => {
	const errors: unknown[] = [];
	const timers = createScopedTimers((error) => errors.push(error));
	let runs = 0;

	timers.setInterval(() => {
		runs++;
		throw new Error(`run ${runs}`);
	}, 1);
	await wait(20);
	timers.dispose();

	expect(runs).toBeGreaterThan(1);
	expect(errors).toHaveLength(runs);
});

test('passes arguments through and never runs a timer cleared by dispose', async () => {
	const seen: string[] = [];
	const timers = createScopedTimers(() => undefined);

	timers.setTimeout((value: string) => seen.push(value), 0, 'first');
	await wait(5);
	timers.setTimeout((value: string) => seen.push(value), 0, 'second');
	timers.dispose();
	await wait(5);

	expect(seen).toEqual(['first']);
});
