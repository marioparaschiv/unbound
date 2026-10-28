import { DEFAULT_EVAL_TIMEOUT_MS, MAX_EVAL_TIMEOUT_MS } from '@unbound-app/debugger-protocol';
import type { EvalResult } from '@unbound-app/debugger-protocol';
import { afterEach, describe, expect, test } from 'bun:test';

import {
	attachController,
	attachDevice,
	detachController,
	detachDevice,
	evaluateForController,
	handleDeviceMessage,
	resolveEvalTimeout,
	type SocketLike,
} from '../src/lib/session';

type RecordingSocket = SocketLike & { frames: unknown[] };

function recordingSocket(): RecordingSocket {
	const frames: unknown[] = [];

	return { frames, send: (data) => void frames.push(JSON.parse(data)), close: () => {} };
}

function evalResults(socket: RecordingSocket): EvalResult[] {
	return socket.frames.filter(
		(frame): frame is EvalResult => (frame as EvalResult).type === 'eval-result',
	);
}

const device = recordingSocket();
const controller = recordingSocket();

afterEach(() => {
	detachController(controller);
	detachDevice(device);
	device.frames.length = 0;
	controller.frames.length = 0;
});

describe('resolveEvalTimeout', () => {
	test('honours a positive timeout and falls back to the default otherwise', () => {
		expect(resolveEvalTimeout(30_000)).toBe(30_000);
		expect(resolveEvalTimeout(undefined)).toBe(DEFAULT_EVAL_TIMEOUT_MS);
		expect(resolveEvalTimeout(0)).toBe(DEFAULT_EVAL_TIMEOUT_MS);
		expect(resolveEvalTimeout(-5)).toBe(DEFAULT_EVAL_TIMEOUT_MS);
		expect(resolveEvalTimeout(Number.NaN)).toBe(DEFAULT_EVAL_TIMEOUT_MS);
		expect(resolveEvalTimeout(Number.POSITIVE_INFINITY)).toBe(MAX_EVAL_TIMEOUT_MS);
	});
});

describe('evaluateForController', () => {
	test('fails the eval once the requested timeout elapses', async () => {
		attachDevice(device);
		attachController(controller);

		evaluateForController(controller, { type: 'eval', id: 'slow', code: 'x', timeout: 30 });
		await Bun.sleep(80);

		expect(evalResults(controller)).toEqual([
			{
				type: 'eval-result',
				id: 'slow',
				ok: false,
				error: 'Evaluation timed out after 30ms.',
			},
		]);
	});

	test('delivers a result that arrives within the requested timeout', async () => {
		attachDevice(device);
		attachController(controller);

		evaluateForController(controller, { type: 'eval', id: 'fast', code: 'x', timeout: 200 });
		await Bun.sleep(20);
		handleDeviceMessage({ type: 'eval-result', id: 'fast', ok: true, value: '42' });
		await Bun.sleep(220);

		expect(device.frames).toEqual([{ type: 'eval', id: 'fast', code: 'x' }]);
		expect(evalResults(controller)).toEqual([
			{ type: 'eval-result', id: 'fast', ok: true, value: '42' },
		]);
	});
});

describe('attachDevice', () => {
	test('lets a reconnecting device replace one that never closed', async () => {
		let closed = false;
		const stale = { ...recordingSocket(), close: () => void (closed = true) };

		attachDevice(stale);
		attachController(controller);
		evaluateForController(controller, { type: 'eval', id: 'stuck', code: 'x', timeout: 1_000 });

		attachDevice(device);
		evaluateForController(controller, { type: 'eval', id: 'fresh', code: 'y', timeout: 200 });
		handleDeviceMessage({ type: 'eval-result', id: 'fresh', ok: true, value: '1' });
		await Bun.sleep(10);

		expect(closed).toBe(true);
		expect(device.frames).toEqual([{ type: 'eval', id: 'fresh', code: 'y' }]);
		expect(evalResults(controller)).toEqual([
			{
				type: 'eval-result',
				id: 'stuck',
				ok: false,
				error: 'Device disconnected before the evaluation completed.',
			},
			{ type: 'eval-result', id: 'fresh', ok: true, value: '1' },
		]);
	});
});
