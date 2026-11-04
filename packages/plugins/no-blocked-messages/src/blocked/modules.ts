import { metro } from '@unbound-app/api';

export const ChatManager = metro.findByName('ChatManager');
export const RowManager = metro.findByName('RowManager');
export const ChatUpdatesQueue = metro.findByName('ChatUpdatesQueue');

export const ChatClassFilters = [
	metro.filters.byName('ChatManager'),
	metro.filters.byName('RowManager'),
	metro.filters.byName('ChatUpdatesQueue'),
];
