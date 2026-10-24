import { metro, patcher, storage } from '@unbound-app/api';

export const MessageRowData = metro.findByProps('generateMessageRowData', { lazy: true });
export const UserProfileStore = metro.findStore('UserProfile', { lazy: true });
export const ChannelStore = metro.findStore('Channel', { lazy: true });
export const MessageStore = metro.findStore('Message', { lazy: true });
export const UserStore = metro.stores.Users;

export const settings = storage.getStore('unbound.pronoundb');

export const Patcher = patcher.createPatcher('unbound.pronoundb');
