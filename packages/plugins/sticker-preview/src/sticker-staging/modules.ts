import { metro, flux } from '@unbound-app/api';

import type { SelectedChannels } from '~/types';

export const ChatInputs = metro.findByProps('getBestActiveInputForChannelId');
export const SelectedChannelStore = flux.getStore('SelectedChannel') as SelectedChannels;
export const DraftStore = flux.getStore('Draft');
export const ChannelStore = flux.getStore('Channel');
export const MessageActions = metro.api.Messages;

// The components are modules whose `default` export is the component, as Discord's file paths hold them.
export const StickerModule = metro.findByFilePath('modules/stickers/native/Sticker.tsx');
export const StickerPickerListRow = metro.findByFilePath(
	'modules/stickers/native/StickerPickerListRow.tsx',
);
export const ChatInputSendButton = metro.findByFilePath(
	'modules/chat_input/native/accessories/ChatInputSendButton.tsx',
);
export const FloatingChatInputContainer = metro.findByFilePath(
	'modules/chat_input/native/FloatingChatInputContainer.tsx',
);
