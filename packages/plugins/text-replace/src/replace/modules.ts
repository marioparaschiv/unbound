import { metro, storage } from '@unbound-app/api';

export const Messages = metro.findByProps('sendMessage', 'receiveMessage');

export const settings = storage.getBucket();
