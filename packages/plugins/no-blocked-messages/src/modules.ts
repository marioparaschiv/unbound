import { metro, patcher } from '@unbound-app/api';

export const ChatManager = metro.findByName('ChatManager', { lazy: true });
export const RowManager = metro.findByName('RowManager', { lazy: true });
export const ChatUpdatesQueue = metro.findByName('ChatUpdatesQueue', { lazy: true });

export const ChatClassFilters = [
	metro.filters.byName('ChatManager'),
	metro.filters.byName('RowManager'),
	metro.filters.byName('ChatUpdatesQueue'),
];

export const Patcher = patcher.createPatcher('unbound.no-blocked-messages');
