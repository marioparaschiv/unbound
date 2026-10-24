import { metro, storage } from '@unbound-app/api';

export const MessageStore = metro.findStore('Message', { lazy: true });
export const SelectedChannelStore = metro.findStore('SelectedChannel', { lazy: true });

export const settings = storage.getStore('unbound.shiki-codeblocks');
