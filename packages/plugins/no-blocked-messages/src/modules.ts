import { metro, patcher } from '@unbound-app/api';

export const ChatManager = metro.findByName('ChatManager', { lazy: true });
export const RowManager = metro.findByName('RowManager', { lazy: true });
export const ChatUpdatesQueue = metro.findByName('ChatUpdatesQueue', { lazy: true });

export const Patcher = patcher.createPatcher('unbound.no-blocked-messages');
