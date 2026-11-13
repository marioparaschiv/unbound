import { describe, expect, test } from 'bun:test';

import { createIdleExit } from '~/lib/idle-exit';

const TIMEOUT_MS = 30;

describe('createIdleExit', () => {
	test('fires when no controller ever attaches', async () => {
		let idled = 0;

		createIdleExit(TIMEOUT_MS, () => idled++);

		await Bun.sleep(TIMEOUT_MS * 2);

		expect(idled).toBe(1);
	});

	test('waits while a controller is attached', async () => {
		let idled = 0;
		const onCount = createIdleExit(TIMEOUT_MS, () => idled++);

		onCount(1);
		await Bun.sleep(TIMEOUT_MS * 2);

		expect(idled).toBe(0);
	});

	test('fires a full timeout after the last controller leaves, not before', async () => {
		let idled = 0;
		const onCount = createIdleExit(TIMEOUT_MS, () => idled++);

		onCount(2);
		onCount(1);
		onCount(0);
		await Bun.sleep(TIMEOUT_MS / 2);
		expect(idled).toBe(0);

		await Bun.sleep(TIMEOUT_MS * 2);
		expect(idled).toBe(1);
	});

	test('a controller arriving during the grace period cancels the exit', async () => {
		let idled = 0;
		const onCount = createIdleExit(TIMEOUT_MS, () => idled++);

		onCount(1);
		onCount(0);
		await Bun.sleep(TIMEOUT_MS / 2);
		onCount(1);
		await Bun.sleep(TIMEOUT_MS * 2);

		expect(idled).toBe(0);
	});
});
