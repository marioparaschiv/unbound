import { metro, storage, flux } from '@unbound-app/api';

export const DraftStore = flux.getStore('Draft');
export const SelectedChannelStore = flux.getStore('SelectedChannel');
export const Users = flux.getStore('User');

export const ChatInputs = metro.findByProps('getBestActiveInputForChannelId');
export const Haptics = metro.findByFilePath('modules/haptics/HapticUtils.native.tsx');
export const ChatInputRightActions = metro.findByFilePath(
	'modules/chat_input/native/action_buttons/ChatInputRightActions.tsx',
);
export const ChatInputSendButton = metro.findByFilePath(
	'modules/chat_input/native/accessories/ChatInputSendButton.tsx',
);

// Whole modules, read through `.default` at use: a lazy handle can be neither rendered nor constructed.
export const ChatItem = metro.findByFilePath('components_native/chat/ChatItem.tsx');
export const MessageRecord = metro.findByName('MessageRecord', { interop: false });
export const RowManager = metro.findByName('RowManager', { interop: false });

export const textReplaceSettings = storage.getBucket('unbound.text-replace');
