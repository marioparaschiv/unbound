import { flux, storage } from '@unbound-app/api';

export const SETTINGS_BUCKET = 'unbound.super-reaction-tweaks';

export const settings = storage.getBucket(SETTINGS_BUCKET);

export const UserStore = flux.getStore('User', { lazy: true });
