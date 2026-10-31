import { metro, storage } from '@unbound-app/api';

export const ThemeStore = metro.findStore('Theme', { lazy: true });

export const MessageStore = metro.findStore('Message', { lazy: true });

export const UserStore = metro.findStore('User', { lazy: true });

export const SelectedChannelStore = metro.findStore('SelectedChannel', { lazy: true });

export const settings = storage.getStore('unbound.chat-bubbles');
