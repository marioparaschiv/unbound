import { metro, patcher, storage } from '@unbound-app/api';

export const Messages = metro.api.Messages;

export const settings = storage.getStore('unbound.text-replace');
export const Patcher = patcher.createPatcher('unbound.text-replace');
