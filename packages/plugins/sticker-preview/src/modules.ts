import { metro, patcher } from '@unbound-app/api';

import type { Sticker } from '@unbound-plugins/shared/stickers/staged-stickers';

export type StickerProps = { animated: boolean; opaque: boolean; size: number; sticker: Sticker };

// What the plugin waits for before it starts: every module below, by file path or else by name.
export const RequiredModules = [
	metro.filters.byProps('getBestActiveInputForChannelId'),
	metro.filters.byStore('Draft'),
	metro.filters.byProps('sendMessage', 'receiveMessage'),
	metro.filters.byStore('SelectedChannel'),
	['modules/stickers/native/Sticker.tsx', metro.filters.byName('Sticker')],
	[
		'modules/stickers/native/StickerPickerListRow.tsx',
		metro.filters.byName('StickerPickerListRow'),
	],
	'modules/chat_input/native/accessories/ChatInputSendButton.tsx',
	'modules/chat_input/native/FloatingChatInputContainer.tsx',
];

export const ChatInputs = metro.findByProps('getBestActiveInputForChannelId', { lazy: true });
export const SelectedChannelStore = metro.findStore('SelectedChannel', { lazy: true });
export const DraftStore = metro.findStore('Draft', { lazy: true });
export const MessageActions = metro.api.Messages;

// Components are found with `interop: false`, by file path first, then by name.
export const StickerModules = [
	metro.findByFilePath('modules/stickers/native/Sticker.tsx', { lazy: true, interop: false }),
	metro.findByName('Sticker', { lazy: true, interop: false }),
];
export const StickerPickerListRowModules = [
	metro.findByFilePath('modules/stickers/native/StickerPickerListRow.tsx', {
		lazy: true,
		interop: false,
	}),
	metro.findByName('StickerPickerListRow', { lazy: true, interop: false }),
];
export const ChatInputSendButton = metro.findByFilePath(
	'modules/chat_input/native/accessories/ChatInputSendButton.tsx',
	{ lazy: true, interop: false },
);
export const FloatingChatInputContainer = metro.findByFilePath(
	'modules/chat_input/native/FloatingChatInputContainer.tsx',
	{ lazy: true, interop: false },
);

export const Patcher = patcher.createPatcher('unbound.sticker-preview');
