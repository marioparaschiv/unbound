import { flux, metro, storage } from '@unbound-app/api';

export const { ActionSheets } = metro.api;
export const RowManager = metro.findByName('RowManager', { lazy: true });
export const ChatManager = metro.findByName('ChatManager', { lazy: true });
export const ReactNative = metro.findByProps('processColor', 'View', { lazy: true });
export const MessageStore = flux.getStore('Message', { lazy: true });
export const ChannelStore = flux.getStore('Channel', { lazy: true });
export const UserStore = flux.getStore('User', { lazy: true });

export const settings = storage.getBucket();
