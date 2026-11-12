import type { EvalResult, ViewDetailsResult } from '@unbound-app/debugger-protocol';
import { afterEach, describe, expect, test } from 'bun:test';

import {
	attachController,
	attachDevice,
	detachController,
	detachDevice,
	evaluateForController,
	handleDeviceMessage,
	relayReactDevtools,
	requestViewDetailsForController,
	type SocketLike,
} from '~/lib/session';

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
				code: 'timeout',
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

describe('detachController', () => {
	test('drops its in-flight eval so a late result goes nowhere', () => {
		attachDevice(device);
		attachController(controller);
		evaluateForController(controller, { type: 'eval', id: 'gone', code: 'x', timeout: 1_000 });
		detachController(controller);
		controller.frames.length = 0;

		handleDeviceMessage({ type: 'eval-result', id: 'gone', ok: true, value: '1' });

		expect(controller.frames).toEqual([]);
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
				code: 'device-disconnected',
			},
			{ type: 'eval-result', id: 'fresh', ok: true, value: '1' },
		]);
	});
});

describe('React DevTools', () => {
	const operations = { type: 'react-devtools', event: 'operations', payload: [1] } as const;
	const inspect = { type: 'react-devtools', event: 'inspectElement', payload: {} } as const;

	test('routes device frames to the controller that last sent one', () => {
		const other = recordingSocket();

		attachDevice(device);
		attachController(controller);
		attachController(other);
		relayReactDevtools(controller, inspect);
		handleDeviceMessage(operations);
		detachController(other);

		expect(device.frames).toEqual([inspect]);
		expect(controller.frames.at(-1)).toEqual(operations);
		expect(other.frames).toEqual([{ type: 'device-status', connected: true }]);
	});

	test('shuts the device session down when the frontend leaves', () => {
		attachDevice(device);
		attachController(controller);
		relayReactDevtools(controller, inspect);
		detachController(controller);
		handleDeviceMessage(operations);

		expect(device.frames).toEqual([inspect, { type: 'react-devtools', event: 'shutdown' }]);
		expect(controller.frames).toEqual([{ type: 'device-status', connected: true }]);
	});
});

describe('requestViewDetailsForController', () => {
	const request = { type: 'view-details-request', id: 'details-1', node: '7' } as const;
	const result: ViewDetailsResult = {
		type: 'view-details-result',
		id: 'details-1',
		ok: true,
		details: { classChain: ['UILabel', 'UIView'], sections: [] },
	};

	test('forwards the request and routes the answer to the controller that asked', () => {
		const other = recordingSocket();

		attachDevice(device);
		attachController(controller);
		attachController(other);
		requestViewDetailsForController(controller, request);
		handleDeviceMessage(result);
		detachController(other);

		expect(device.frames).toEqual([request]);
		expect(controller.frames.at(-1)).toEqual(result);
		expect(other.frames).toEqual([{ type: 'device-status', connected: true }]);
	});

	test('fails at once without a device, and in flight when the device leaves', () => {
		attachController(controller);
		requestViewDetailsForController(controller, request);
		attachDevice(device);
		requestViewDetailsForController(controller, { ...request, id: 'details-2' });
		detachDevice(device);

		expect(
			controller.frames.filter(
				(frame) => (frame as { type: string }).type === 'view-details-result',
			),
		).toEqual([
			{
				type: 'view-details-result',
				id: 'details-1',
				ok: false,
				error: 'No device is connected to the debugger.',
			},
			{
				type: 'view-details-result',
				id: 'details-2',
				ok: false,
				error: 'Device disconnected before the view was read.',
			},
		]);
	});

	test('drops an answer for a controller that left', () => {
		attachDevice(device);
		attachController(controller);
		requestViewDetailsForController(controller, request);
		detachController(controller);
		controller.frames.length = 0;

		handleDeviceMessage(result);

		expect(controller.frames).toEqual([]);
	});
});

describe('device hello', () => {
	test('reports the device to controllers until it disconnects', () => {
		const info = {
			platform: 'android',
			discordVersion: '352.10',
			loaderVersion: '1.0.0',
			clientVersion: '0.9.0',
		};

		attachDevice(device);
		attachController(controller);
		handleDeviceMessage({ type: 'hello', device: info });
		detachDevice(device);

		expect(controller.frames).toEqual([
			{ type: 'device-status', connected: true },
			{ type: 'device-status', connected: true, device: info },
			{ type: 'device-status', connected: false },
		]);
	});
});
