import type { NativeBatchStep, NativeHandle, NativeObjectHandle } from '@unbound-app/api/native';

export type NativeMessageInfo = {
	channelId?: string;
	messageId: string;
};

/** The part of the Objective-C bridge that reading a message cell needs. */
export type NativeMessageCellBridge = {
	batch(steps: readonly NativeBatchStep[]): Promise<unknown[]>;
	// UNKNOWN: an ivar or selector result can be any Objective-C value.
	getIvar(handle: NativeObjectHandle, name: string): unknown;
	// UNKNOWN: an ivar or selector result can be any Objective-C value.
	invokeAsync(handle: NativeObjectHandle, selector: string, args: unknown[]): Promise<unknown>;
	respondsTo(handle: NativeHandle, selector: string): boolean;
};

// UNKNOWN: a value returned by the bridge, which may be a string, a number, or an object handle.
function stringValue(value: unknown): string | undefined {
	if (typeof value === 'string' && value.length > 0) {
		return value;
	}

	if (typeof value === 'number' || typeof value === 'bigint') {
		return String(value);
	}
}

// UNKNOWN: a value returned by the bridge, read through `description` when it is an object.
async function nativeString(
	value: unknown,
	bridge: NativeMessageCellBridge,
): Promise<string | undefined> {
	const direct = stringValue(value);

	if (direct || !value || typeof value !== 'object') {
		return direct;
	}

	const handle = value as NativeObjectHandle;

	if (!bridge.respondsTo(handle, 'description')) return;

	return stringValue(await bridge.invokeAsync(handle, 'description', []));
}

async function readChannelId(
	message: NativeObjectHandle,
	bridge: NativeMessageCellBridge,
): Promise<string | undefined> {
	if (bridge.respondsTo(message, 'channelId')) {
		const channelId = await nativeString(
			await bridge.invokeAsync(message, 'channelId', []),
			bridge,
		);

		if (channelId) {
			return channelId;
		}
	}

	if (!bridge.respondsTo(message, 'channel')) return;

	const channel = (await bridge.invokeAsync(message, 'channel', [])) as NativeObjectHandle | null;

	if (!channel || !bridge.respondsTo(channel, 'id')) return;

	return nativeString(await bridge.invokeAsync(channel, 'id', []), bridge);
}

/**
 * @description Reads which message a `DCDMessageTableViewCell` shows, from its view model.
 * @param cell The message cell.
 * @param bridge The Objective-C bridge.
 * @param selectedChannelId Returns the channel to report when the message names none; called before the native reads start.
 * @returns The message and channel IDs, or `undefined` when the cell has no message or was reused while it was read.
 */
export async function readNativeMessageInfo(
	cell: NativeObjectHandle,
	bridge: NativeMessageCellBridge,
	selectedChannelId?: () => string | undefined,
): Promise<NativeMessageInfo | undefined> {
	const fallbackChannelId = selectedChannelId?.();

	try {
		const viewModel = bridge.getIvar(cell, 'viewModel') as NativeObjectHandle | null;

		if (!viewModel || !bridge.respondsTo(viewModel, 'message')) return;

		const [message, id] = await bridge.batch([
			{ target: viewModel, selector: 'message', args: [] },
			{ target: { $nativeBatchResult: 0 }, selector: 'id', args: [] },
		]);

		if (!message) return;

		const messageId = await nativeString(id, bridge);

		if (!messageId) return;

		const channelId =
			(await readChannelId(message as NativeObjectHandle, bridge)) ?? fallbackChannelId;
		const currentViewModel = bridge.getIvar(cell, 'viewModel') as NativeObjectHandle | null;

		// A reused cell has a new view model, so the IDs read above belong to another message.
		if (
			!currentViewModel ||
			!(await bridge.invokeAsync(viewModel, 'isEqual:', [currentViewModel]))
		) {
			return;
		}

		return { channelId, messageId };
	} catch {
		// The cell was deallocated while it was being read.
		return;
	}
}

export default { readNativeMessageInfo };
