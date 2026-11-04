import { flux, metro } from '@unbound-app/api';

export const MessageRowData = metro.findByProps('generateMessageRowData');

export const RelationshipStore = flux.getStore('Relationship');
export const UserStore = flux.getStore('User');
