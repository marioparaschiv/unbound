import { metro, flux } from '@unbound-app/api';

export const ChatInputs = metro.findByProps('getBestActiveInputForChannelId', { lazy: true });
export const SelectedChannelStore = flux.getStore('SelectedChannel', { lazy: true });
export const ChannelStore = flux.getStore('Channel', { lazy: true });
export const UserStore = flux.getStore('User', { lazy: true });

// The same module as `metro.common.Theme`, which the generated typings do not declare yet.
export const Theme = metro.findByProps('colors', 'internal', { lazy: true });
