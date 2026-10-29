import { metro, storage } from '@unbound-app/api';

export const ThemeStore = metro.findStore('Theme', { lazy: true });

export const settings = storage.getStore('unbound.chat-bubbles');
