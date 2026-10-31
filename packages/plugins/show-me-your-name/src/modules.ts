import { metro, patcher, storage } from '@unbound-app/api';

export const MessageRowData = metro.findByProps('generateMessageRowData', { lazy: true });
export const RelationshipStore = metro.findStore('Relationship', { lazy: true });
export const UserStore = metro.stores.Users;

export const settings = storage.getStore('astral.show-me-your-name');

export const Patcher = patcher.createPatcher('astral.show-me-your-name');
