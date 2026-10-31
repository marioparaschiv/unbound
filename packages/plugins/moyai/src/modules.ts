import { storage, flux } from '@unbound-app/api';

export const SelectedChannelStore = flux.getStore('SelectedChannel', { lazy: true });

export const settings = storage.getBucket();
