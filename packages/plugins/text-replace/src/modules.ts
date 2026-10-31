import { metro, storage } from '@unbound-app/api';

export const Messages = metro.api.Messages;

export const settings = storage.getBucket();
