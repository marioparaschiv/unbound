import type { FluxStore } from '@unbound-app/api/flux';
import { metro, flux } from '@unbound-app/api';

import type { LatencyMessage } from '~/lib/latency';

type ThemeFluxStore = FluxStore & {
	theme?: string;
};

type ChannelMessages = { toArray?(): LatencyMessage[] };

type MessageFluxStore = FluxStore & {
	getMessages?(channelId: string): ChannelMessages | undefined;
};

type SelectedChannelFluxStore = FluxStore & {
	getChannelId?(): string | undefined;
};

export const UserStore = flux.getStore('User');
export const MessageStore: MessageFluxStore = flux.getStore('Message');
export const SelectedChannelStore: SelectedChannelFluxStore = flux.getStore('SelectedChannel');
export const ThemeStore: ThemeFluxStore = flux.getStore('Theme');
export const Theme = metro.common.Theme;
