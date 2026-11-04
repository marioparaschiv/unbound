import { flux, metro } from '@unbound-app/api';

export const ChatInputs = metro.findByProps('getBestActiveInputForChannelId');
export const FloatingChatInputContainer = metro.findByFilePath(
	'modules/chat_input/native/FloatingChatInputContainer.tsx',
);

export const SelectedChannelStore = flux.getStore('SelectedChannel');
export const ChannelStore = flux.getStore('Channel');
export const UserStore = flux.getStore('User');
