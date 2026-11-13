import type { MetroChildrenRequest, MetroModulesResult } from '@unbound-app/debugger-protocol';
import { afterEach, describe, expect, test } from 'bun:test';

import {
	attachController,
	attachDevice,
	detachController,
	detachDevice,
	handleDeviceMessage,
	requestMetroForController,
	type SocketLike,
} from '~/lib/session';

type RecordingSocket = SocketLike & { frames: unknown[] };

function recordingSocket(): RecordingSocket {
	const frames: unknown[] = [];

	return { frames, send: (data) => void frames.push(JSON.parse(data)), close: () => {} };
}

const metroFrames = (socket: RecordingSocket) =>
	socket.frames.filter((frame) => (frame as { type: string }).type.startsWith('metro-'));

const device = recordingSocket();
const controller = recordingSocket();

const modules = { type: 'metro-modules-request', id: 'modules-1', filter: 'Store' } as const;
const children: MetroChildrenRequest = {
	type: 'metro-children-request',
	id: 'children-1',
	target: { module: 42 },
};
const answer: MetroModulesResult = {
	type: 'metro-modules-result',
	id: 'modules-1',
	ok: true,
	modules: [],
	total: 0,
	loaded: 0,
	count: 0,
};

afterEach(() => {
	detachController(controller);
	detachDevice(device);
	device.frames.length = 0;
	controller.frames.length = 0;
});

describe('requestMetroForController', () => {
	test('forwards the request and routes the answer to the controller that asked', () => {
		const other = recordingSocket();

		attachDevice(device);
		attachController(controller);
		attachController(other);
		requestMetroForController(controller, modules);
		handleDeviceMessage(answer);
		detachController(other);

		expect(device.frames).toEqual([modules]);
		expect(metroFrames(controller)).toEqual([answer]);
		expect(metroFrames(other)).toEqual([]);
	});

	test('fails at once without a device, and in flight with the matching result type when it leaves', () => {
		attachController(controller);
		requestMetroForController(controller, modules);
		attachDevice(device);
		requestMetroForController(controller, children);
		detachDevice(device);

		expect(metroFrames(controller)).toEqual([
			{
				type: 'metro-modules-result',
				id: 'modules-1',
				ok: false,
				error: 'No device is connected to the debugger.',
				code: 'failed',
			},
			{
				type: 'metro-children-result',
				id: 'children-1',
				ok: false,
				error: 'Device disconnected before Metro answered.',
				code: 'failed',
			},
		]);
	});

	test('drops an answer for a controller that left', () => {
		attachDevice(device);
		attachController(controller);
		requestMetroForController(controller, modules);
		detachController(controller);
		controller.frames.length = 0;

		handleDeviceMessage(answer);

		expect(controller.frames).toEqual([]);
	});
});
