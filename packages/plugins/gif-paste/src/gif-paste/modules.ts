import { metro } from '@unbound-app/api';

export const MessageActions = metro.api.Messages;
export const ReplyActions = metro.findByProps('deletePendingReply');
export const PendingReplyStore = metro.findByProps('getPendingReply');
export const ChatInputRegistry = metro.findByProps('getBestActiveInputForChannelId');
