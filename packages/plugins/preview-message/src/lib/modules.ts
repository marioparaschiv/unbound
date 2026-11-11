import { metro, flux } from '@unbound-app/api';

export const DraftStore = flux.getStore('Draft');
export const SelectedChannelStore = flux.getStore('SelectedChannel');
export const Users = flux.getStore('User');

// Optional: without them the preview skips the haptic tap and closes only the system keyboard.
export const ChatInputs = metro.findByProps('getBestActiveInputForChannelId');
export const Haptics = metro.findByFilePath('modules/haptics/HapticUtils.native.tsx');

/**
 * @description Looks up the modules the preview draws and builds the message with.
 * Whole modules, read through `.default` at use: a lazy handle can be neither rendered nor constructed.
 * @returns `ChatItem`, `MessageRecord` and `RowManager`, or `undefined` when Discord moved one of them.
 */
export function findPreviewModules() {
	const ChatItem = metro.findByFilePath('components_native/chat/ChatItem.tsx');
	const MessageRecord = metro.findByName('MessageRecord', { interop: false });
	const RowManager = metro.findByName('RowManager', { interop: false });

	if (!ChatItem || !MessageRecord || !RowManager) return;

	return { ChatItem, MessageRecord, RowManager };
}

/** The modules the preview draws and builds the message with. */
export type PreviewModules = NonNullable<ReturnType<typeof findPreviewModules>>;
