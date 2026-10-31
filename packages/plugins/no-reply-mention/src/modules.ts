import { metro, patcher, storage } from '@unbound-app/api';

export const PendingReplyActions = metro.findByProps('createPendingReply', { lazy: true });

export const settings = storage.getStore('astral.no-reply-mention');

export const Patcher = patcher.createPatcher('astral.no-reply-mention');
