import { storage, flux } from '@unbound-app/api';

export const MessageStore = flux.getStore('Message', { lazy: true });
export const SelectedChannelStore = flux.getStore('SelectedChannel', { lazy: true });

export const settings = storage.getBucket();
