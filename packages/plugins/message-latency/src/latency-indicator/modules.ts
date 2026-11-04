import type { FluxStore } from '@unbound-app/api/flux';
import { metro, flux } from '@unbound-app/api';

type ThemeFluxStore = FluxStore & {
	theme?: string;
};

export const UserStore = flux.getStore('User');
export const ThemeStore: ThemeFluxStore = flux.getStore('Theme');
export const Theme = metro.common.Theme;
export const Tooltips = metro.findByProps('TooltipArrowDirections', 'TooltipArrowPositions');

export const MessageRowData = metro.findByProps('generateMessageRowData');
