import { metro, patcher } from '@unbound-app/api';

export const MessageActions = metro.api.Messages;
export const ReplyActions = metro.findByProps('deletePendingReply', { lazy: true });
export const PendingReplyStore = metro.findByProps('getPendingReply', { lazy: true });
export const ChatInputRegistry = metro.findByProps('getBestActiveInputForChannelId', {
	lazy: true,
});

export const Patcher = patcher.createPatcher('unbound.gif-paste');
