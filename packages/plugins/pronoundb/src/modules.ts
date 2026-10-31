import { metro, storage, flux } from '@unbound-app/api';

export const MessageRowData = metro.findByProps('generateMessageRowData', { lazy: true });
export const UserProfileStore = flux.getStore('UserProfile', { lazy: true });
export const ChannelStore = flux.getStore('Channel', { lazy: true });
export const MessageStore = flux.getStore('Message', { lazy: true });
export const UserStore = flux.getStore('User', { lazy: true });

export const settings = storage.getBucket();
