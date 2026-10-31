import { metro, storage } from '@unbound-app/api';

export const PendingReplyActions = metro.findByProps('createPendingReply', { lazy: true });

export const settings = storage.getBucket();
