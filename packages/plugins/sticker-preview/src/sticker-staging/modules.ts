import { metro, flux } from '@unbound-app/api';

import type { SelectedChannels } from '~/types';

export const ChatInputs = metro.findByProps('getBestActiveInputForChannelId');
export const SelectedChannelStore = flux.getStore('SelectedChannel') as SelectedChannels;
export const DraftStore = flux.getStore('Draft');
export const ChannelStore = flux.getStore('Channel');
export const MessageActions = metro.api.Messages;

// Each component is a module whose `default` export is the component, found by the file path Discord holds it at, else by its name for a build that moved it.
function findComponent(filePath: string, name: string) {
	return metro.find(
		metro.filters.any(metro.filters.byFilePath(filePath), metro.filters.byName(name)),
		{ interop: false },
	);
}

export const StickerModule = findComponent('modules/stickers/native/Sticker.tsx', 'Sticker');
export const StickerPickerListRow = findComponent(
	'modules/stickers/native/StickerPickerListRow.tsx',
	'StickerPickerListRow',
);
export const ChatInputSendButton = findComponent(
	'modules/chat_input/native/accessories/ChatInputSendButton.tsx',
	'ChatInputSendButton',
);
export const FloatingChatInputContainer = findComponent(
	'modules/chat_input/native/FloatingChatInputContainer.tsx',
	'FloatingChatInputContainer',
);
