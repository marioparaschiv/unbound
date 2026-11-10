import { flux, storage } from '@unbound-app/api';

export const settings = storage.getBucket(addon.id);

export const UserStore = flux.getStore('User', { lazy: true });
