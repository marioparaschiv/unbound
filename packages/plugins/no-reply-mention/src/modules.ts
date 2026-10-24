import { metro, patcher, storage } from '@unbound-app/api';

export const PendingReplyActions = metro.findByProps('createPendingReply', { lazy: true });

export const settings = storage.getStore('unbound.no-reply-mention');

export const Patcher = patcher.createPatcher('unbound.no-reply-mention');
