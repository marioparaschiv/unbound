import type { ExplorerMembersResult, ExplorerValuesRequest } from '@unbound-app/debugger-protocol';
import { afterEach, describe, expect, test } from 'bun:test';

import {
	attachController,
	attachDevice,
	detachController,
	detachDevice,
	handleDeviceMessage,
	requestExplorerForController,
	type SocketLike,
} from '~/lib/session';

type RecordingSocket = SocketLike & { frames: unknown[] };

function recordingSocket(): RecordingSocket {
	const frames: unknown[] = [];

	return { frames, send: (data) => void frames.push(JSON.parse(data)), close: () => {} };
}

const explorerFrames = (socket: RecordingSocket) =>
	socket.frames.filter((frame) => (frame as { type: string }).type.startsWith('explorer-'));

const device = recordingSocket();
const controller = recordingSocket();

const members = {
	type: 'explorer-members-request',
	id: 'members-1',
	className: 'UILabel',
	kind: 'properties',
} as const;
const values: ExplorerValuesRequest = {
	type: 'explorer-values-request',
	id: 'values-1',
	object: 'k3f9:1',
	className: 'UILabel',
	kind: 'ivars',
	names: ['_text'],
};
const answer: ExplorerMembersResult = {
	type: 'explorer-members-result',
	id: 'members-1',
	ok: true,
	members: [],
	total: 0,
};

afterEach(() => {
	detachController(controller);
	detachDevice(device);
	device.frames.length = 0;
	controller.frames.length = 0;
});

describe('requestExplorerForController', () => {
	test('forwards the request and routes the answer to the controller that asked', () => {
		const other = recordingSocket();

		attachDevice(device);
		attachController(controller);
		attachController(other);
		requestExplorerForController(controller, members);
		handleDeviceMessage(answer);
		detachController(other);

		expect(device.frames).toEqual([members]);
		expect(explorerFrames(controller)).toEqual([answer]);
		expect(explorerFrames(other)).toEqual([]);
	});

	test('fails at once without a device, and in flight with the matching result type when it leaves', () => {
		attachController(controller);
		requestExplorerForController(controller, members);
		attachDevice(device);
		requestExplorerForController(controller, values);
		detachDevice(device);

		expect(explorerFrames(controller)).toEqual([
			{
				type: 'explorer-members-result',
				id: 'members-1',
				ok: false,
				error: 'No device is connected to the debugger.',
				code: 'failed',
			},
			{
				type: 'explorer-values-result',
				id: 'values-1',
				ok: false,
				error: 'Device disconnected before the explorer answered.',
				code: 'failed',
			},
		]);
	});

	test('drops an answer for a controller that left', () => {
		attachDevice(device);
		attachController(controller);
		requestExplorerForController(controller, members);
		detachController(controller);
		controller.frames.length = 0;

		handleDeviceMessage(answer);

		expect(controller.frames).toEqual([]);
	});
});
