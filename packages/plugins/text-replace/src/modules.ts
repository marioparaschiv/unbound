import { metro, patcher, storage } from '@unbound-app/api';

export const Messages = metro.api.Messages;

export const settings = storage.getStore('astral.text-replace');
export const Patcher = patcher.createPatcher('astral.text-replace');
