import { metro, storage, flux } from '@unbound-app/api';

export const MessageRowData = metro.findByProps('generateMessageRowData', { lazy: true });
export const RelationshipStore = flux.getStore('Relationship', { lazy: true });
export const UserStore = flux.getStore('User', { lazy: true });

export const settings = storage.getBucket();
