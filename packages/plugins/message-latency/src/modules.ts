import { metro, patcher, storage } from '@unbound-app/api';

export const UserStore = metro.stores.Users;
export const ThemeStore = metro.findStore('Theme', { lazy: true });
// The same module as `metro.common.Theme`, which its typings do not declare yet.
export const Theme = metro.findByProps('colors', 'internal', { lazy: true });
export const Tooltips = metro.findByProps('TooltipArrowDirections', 'TooltipArrowPositions', {
	lazy: true,
});

export const MessageRowData = metro.findByProps('generateMessageRowData', { lazy: true });

export const settings = storage.getStore('unbound.message-latency');
export const Patcher = patcher.createPatcher('unbound.message-latency');
