import { metro, patcher } from '@unbound-app/api';

export const MultiAccountStore = metro.findStore('MultiAccount', { lazy: true });

export const Patcher = patcher.createPatcher('unbound.multi-account');
