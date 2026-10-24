import { metro, patcher, storage } from '@unbound-app/api';

export const ChatInputs = metro.findByProps('getBestActiveInputForChannelId', { lazy: true });
export const SelectedChannelStore = metro.findStore('SelectedChannel', { lazy: true });
export const UserStore = metro.stores.Users;

// The same module as `metro.common.Theme`, which the generated typings do not declare yet.
export const Theme = metro.findByProps('colors', 'internal', { lazy: true });

export const settings = storage.getStore('unbound.character-counter');
export const Patcher = patcher.createPatcher('unbound.character-counter');
