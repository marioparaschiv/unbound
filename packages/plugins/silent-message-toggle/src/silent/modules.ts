import { flux, metro } from '@unbound-app/api';

export const Messages = metro.findByProps('sendMessage', 'receiveMessage');
export const SelectedChannelStore = flux.getStore('SelectedChannel');
export const Theme = metro.common.Theme;
export const ChatInputRightActions = metro.findByFilePath(
	'modules/chat_input/native/action_buttons/ChatInputRightActions.tsx',
);
export const ChatInputSendButton = metro.findByFilePath(
	'modules/chat_input/native/accessories/ChatInputSendButton.tsx',
);
export const Haptics = metro.findByFilePath('modules/haptics/HapticUtils.native.tsx');
