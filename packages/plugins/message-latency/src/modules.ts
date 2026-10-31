import type { FluxStore } from '@unbound-app/api/flux';
import { metro, storage, flux } from '@unbound-app/api';

type ThemeFluxStore = FluxStore & {
	theme?: string;
};

export const UserStore = flux.getStore('User', { lazy: true });
export const ThemeStore: ThemeFluxStore = flux.getStore('Theme', { lazy: true });
// The same module as `metro.common.Theme`, which its typings do not declare yet.
export const Theme = metro.findByProps('colors', 'internal', { lazy: true });
export const Tooltips = metro.findByProps('TooltipArrowDirections', 'TooltipArrowPositions', {
	lazy: true,
});

export const MessageRowDataFilter = metro.filters.byProps('generateMessageRowData');

export const settings = storage.getBucket();
