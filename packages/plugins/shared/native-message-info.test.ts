import { describe, expect, test } from 'bun:test';
import type { NativeObjectHandle } from '@unbound-app/api/native';

import { readNativeMessageInfo, type NativeMessageCellBridge } from './native-message-info';

describe('native message cell lookup', () => {
	test('reads the message and channel asynchronously in one dependent batch', async () => {
		const cell = {} as NativeObjectHandle;
		const viewModel = {} as NativeObjectHandle;
		const message = {} as NativeObjectHandle;
		let batchSteps = 0;
		const bridge: NativeMessageCellBridge = {
			batch: async (steps) => {
				batchSteps = steps.length;
				expect(steps[1].target).toEqual({ $nativeBatchResult: 0 });
				return [message, 'message-1'];
			},
			getIvar: () => viewModel,
			invokeAsync: async (handle, selector) => {
				if (handle === message && selector === 'channelId') return 'channel-1';
				if (handle === viewModel && selector === 'isEqual:') return true;
				return null;
			},
			respondsTo: (handle, selector) =>
				(handle === viewModel && selector === 'message') ||
				(handle === message && selector === 'channelId'),
		};

		expect(await readNativeMessageInfo(cell, bridge, () => 'other-channel')).toEqual({
			channelId: 'channel-1',
			messageId: 'message-1',
		});
		expect(batchSteps).toBe(2);
	});

	test('rejects a result when the cell was reused while the request was pending', async () => {
		const cell = {} as NativeObjectHandle;
		const viewModel = {} as NativeObjectHandle;
		const replacement = {} as NativeObjectHandle;
		const message = {} as NativeObjectHandle;
		let currentViewModel = viewModel;
		const bridge: NativeMessageCellBridge = {
			batch: async () => {
				currentViewModel = replacement;
				return [message, 'old-message'];
			},
			getIvar: () => currentViewModel,
			invokeAsync: async (handle, selector, args) =>
				handle === viewModel && selector === 'isEqual:' ? args[0] === viewModel : null,
			respondsTo: (handle, selector) => handle === viewModel && selector === 'message',
		};

		expect(await readNativeMessageInfo(cell, bridge, () => 'channel-1')).toBeUndefined();
	});

	test('uses the channel selected before the asynchronous lookup began', async () => {
		const cell = {} as NativeObjectHandle;
		const viewModel = {} as NativeObjectHandle;
		const message = {} as NativeObjectHandle;
		let selected = 'original-channel';
		const bridge: NativeMessageCellBridge = {
			batch: async () => {
				selected = 'next-channel';
				return [message, 'message-1'];
			},
			getIvar: () => viewModel,
			invokeAsync: async (_handle, selector) => selector === 'isEqual:',
			respondsTo: (handle, selector) => handle === viewModel && selector === 'message',
		};

		expect(await readNativeMessageInfo(cell, bridge, () => selected)).toEqual({
			channelId: 'original-channel',
			messageId: 'message-1',
		});
	});

	test('returns the message without a channel when no fallback is provided', async () => {
		const cell = {} as NativeObjectHandle;
		const viewModel = {} as NativeObjectHandle;
		const message = {} as NativeObjectHandle;
		const bridge: NativeMessageCellBridge = {
			batch: async () => [message, 'message-1'],
			getIvar: () => viewModel,
			invokeAsync: async (_handle, selector) => selector === 'isEqual:',
			respondsTo: (handle, selector) => handle === viewModel && selector === 'message',
		};

		expect(await readNativeMessageInfo(cell, bridge)).toEqual({
			channelId: undefined,
			messageId: 'message-1',
		});
	});
});
