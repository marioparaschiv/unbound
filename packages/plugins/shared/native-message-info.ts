import type { NativeBatchStep, NativeHandle, NativeObjectHandle } from '@unbound-app/api/native';

export type NativeMessageInfo = {
	channelId?: string;
	messageId: string;
};

export interface NativeMessageCellBridge {
	batch(steps: readonly NativeBatchStep[]): Promise<unknown[]>;
	getIvar(handle: NativeObjectHandle, name: string): unknown;
	invokeAsync(handle: NativeObjectHandle, selector: string, args: unknown[]): Promise<unknown>;
	respondsTo(handle: NativeHandle, selector: string): boolean;
}

function stringValue(value: unknown): string | undefined {
	if (typeof value === 'string' && value.length > 0) return value;
	if (typeof value === 'number' || typeof value === 'bigint') return String(value);
}

async function nativeStringAsync(
	value: unknown,
	bridge: NativeMessageCellBridge,
): Promise<string | undefined> {
	const direct = stringValue(value);
	if (direct || !value || typeof value !== 'object') return direct;
	const handle = value as NativeObjectHandle;
	if (!bridge.respondsTo(handle, 'description')) return;
	return stringValue(await bridge.invokeAsync(handle, 'description', []));
}

export async function readNativeMessageInfo(
	cell: NativeObjectHandle,
	bridge: NativeMessageCellBridge,
	selectedChannelId?: () => string | undefined,
): Promise<NativeMessageInfo | undefined> {
	const fallbackChannelId = selectedChannelId?.();
	try {
		const viewModel = bridge.getIvar(cell, 'viewModel') as NativeObjectHandle | null;
		if (!viewModel || !bridge.respondsTo(viewModel, 'message')) return;
		const values = await bridge.batch([
			{ target: viewModel, selector: 'message', args: [] },
			{ target: { $nativeBatchResult: 0 }, selector: 'id', args: [] },
		]);
		const message = values[0] as NativeObjectHandle | null;
		if (!message) return;
		const messageId = await nativeStringAsync(values[1], bridge);
		if (!messageId) return;
		let channelId: string | undefined;
		for (const selector of ['channelId', 'channel_id']) {
			if (!bridge.respondsTo(message, selector)) continue;
			channelId = await nativeStringAsync(
				await bridge.invokeAsync(message, selector, []),
				bridge,
			);
			if (channelId) break;
		}
		if (!channelId && bridge.respondsTo(message, 'channel')) {
			const channel = (await bridge.invokeAsync(
				message,
				'channel',
				[],
			)) as NativeObjectHandle | null;
			if (channel && bridge.respondsTo(channel, 'id')) {
				channelId = await nativeStringAsync(
					await bridge.invokeAsync(channel, 'id', []),
					bridge,
				);
			}
		}
		channelId ??= fallbackChannelId;
		const currentViewModel = bridge.getIvar(cell, 'viewModel') as NativeObjectHandle | null;
		if (
			!currentViewModel ||
			!(await bridge.invokeAsync(viewModel, 'isEqual:', [currentViewModel]))
		)
			return;
		return { channelId, messageId };
	} catch {
		return;
	}
}
