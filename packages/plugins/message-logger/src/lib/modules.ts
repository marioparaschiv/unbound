import { flux, metro } from '@unbound-app/api';

export const MessageStore = flux.getStore('Message');
export const ChannelStore = flux.getStore('Channel');
export const UserStore = flux.getStore('User');

export const { ActionSheets } = metro.api;

/**
 * @description Looks up Discord's chat row modules, through which the log shows; without them no feature can show what it logs.
 * @returns `RowManager` and `ChatManager`, or `undefined` when Discord moved one of them.
 */
export function findChatModules() {
	const RowManager = metro.findByName('RowManager');
	const ChatManager = metro.findByName('ChatManager');

	if (!RowManager || !ChatManager) return;

	return { RowManager, ChatManager };
}
