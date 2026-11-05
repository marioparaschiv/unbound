import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test';

import { createController } from '~/picture-in-picture/session/controller';
import { createSessionStore } from '~/picture-in-picture/session/store';
import type { EnterResult, PipWindow } from '~/types';

const GIVE_UP_MS = 20;

function fakeWindow(enter: EnterResult | Promise<EnterResult>, exit: 'pending' | 'ended') {
	const calls = { enter: [] as (readonly [number, number])[], exit: 0, dispose: 0 };
	const window: PipWindow = {
		enter: (aspect) => {
			calls.enter.push(aspect);

			return Promise.resolve(enter);
		},
		exit: () => {
			calls.exit += 1;

			return exit;
		},
		dispose: () => {
			calls.dispose += 1;
		},
	};

	return { window, calls };
}

function setup(enter: EnterResult | Promise<EnterResult>, exit: 'pending' | 'ended') {
	const sessions = createSessionStore<string>();
	const { window, calls } = fakeWindow(enter, exit);
	const failures = { count: 0 };
	const controller = createController(sessions, window, {
		onFailed: () => {
			failures.count += 1;
		},
		giveUpAfterMs: GIVE_UP_MS,
	});

	return { sessions, calls, failures, controller };
}

const MICROTASK_TURNS = 10;

// Settles the promise chains, runs the timers due within `ms` of fake time, then settles what they started.
async function wait(ms = 0) {
	for (let turn = 0; turn < MICROTASK_TURNS; turn++) await Promise.resolve();

	jest.advanceTimersByTime(ms);

	for (let turn = 0; turn < MICROTASK_TURNS; turn++) await Promise.resolve();
}

beforeEach(() => void jest.useFakeTimers());
afterEach(() => void jest.useRealTimers());

describe('createController', () => {
	test('a window that opens at once activates the session with the video shape', async () => {
		const { sessions, calls, controller } = setup('active', 'ended');

		controller.toggle('a', { width: 1280, height: 720 });
		await wait();

		expect(calls.enter).toEqual([[1280, 720]]);
		expect(sessions.of('a')?.phase).toBe('active');

		controller.toggle('a', undefined);
		expect(calls.exit).toBe(1);
		expect(sessions.current()).toBeNull();

		controller.dispose();
		expect(calls.dispose).toBe(1);
	});

	test('a pending window waits for the player to report it', async () => {
		const { sessions, controller } = setup('pending', 'pending');

		controller.toggle('a', undefined);
		await wait();
		expect(sessions.of('a')?.phase).toBe('starting');

		sessions.activate('a');
		controller.toggle('a', undefined);
		expect(sessions.of('a')?.phase).toBe('stopping');

		controller.dispose();
	});

	test('a window that fails ends the session and reports the failure', async () => {
		const { sessions, failures, controller } = setup('failed', 'ended');

		controller.toggle('a', undefined);
		await wait();

		expect(sessions.current()).toBeNull();
		expect(failures.count).toBe(1);

		controller.dispose();
	});

	test('a session that never turns active is given up with a failure', async () => {
		const { sessions, failures, controller } = setup('pending', 'pending');

		controller.toggle('a', undefined);
		await wait(GIVE_UP_MS * 3);

		expect(sessions.current()).toBeNull();
		expect(failures.count).toBe(1);

		controller.dispose();
	});

	test('a session that turns active in time is kept', async () => {
		const { sessions, failures, controller } = setup('pending', 'pending');

		controller.toggle('a', undefined);
		await wait();
		sessions.activate('a');
		await wait(GIVE_UP_MS * 3);

		expect(sessions.of('a')?.phase).toBe('active');
		expect(failures.count).toBe(0);

		controller.dispose();
	});

	test('a stop the player never confirms ends the session without a failure', async () => {
		const { sessions, failures, controller } = setup('pending', 'pending');

		controller.toggle('a', undefined);
		await wait();
		sessions.activate('a');
		controller.toggle('a', undefined);
		await wait(GIVE_UP_MS * 3);

		expect(sessions.current()).toBeNull();
		expect(failures.count).toBe(0);

		controller.dispose();
	});

	test('dispose cancels the give-up timer, ignores presses and tells listeners', async () => {
		const { sessions, calls, failures, controller } = setup('pending', 'pending');
		let heard = 0;

		controller.subscribe(() => {
			heard += 1;
		});
		controller.toggle('a', undefined);
		controller.dispose();
		sessions.end();
		await wait(GIVE_UP_MS * 3);

		expect(controller.isDisposed()).toBe(true);
		expect(heard).toBe(1);
		expect(failures.count).toBe(0);

		controller.toggle('b', undefined);
		await wait();

		expect(calls.enter).toHaveLength(1);
		expect(sessions.current()).toBeNull();

		controller.dispose();
		expect(calls.dispose).toBe(1);
	});

	test('a window that opens after dispose does not activate or report', async () => {
		let open: (result: EnterResult) => void = () => {};
		const entered = new Promise<EnterResult>((resolve) => {
			open = resolve;
		});
		const { sessions, failures, controller } = setup(entered, 'ended');

		controller.toggle('a', undefined);
		controller.dispose();
		open('failed');
		await wait();

		expect(sessions.of('a')?.phase).toBe('starting');
		expect(failures.count).toBe(0);
	});
});
