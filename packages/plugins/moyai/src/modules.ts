import { metro, storage } from '@unbound-app/api';

export const SelectedChannelStore = metro.findStore('SelectedChannel', { lazy: true });

export const settings = storage.getStore('unbound.moyai');
