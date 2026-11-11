import { flux } from '@unbound-app/api';

export const UserStore = flux.getStore('User', { lazy: true });
