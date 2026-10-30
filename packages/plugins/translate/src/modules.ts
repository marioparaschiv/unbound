import { metro, patcher, storage } from '@unbound-app/api';

export const ActionSheets = metro.api.ActionSheets;

export const settings = storage.getStore('astral.translate');
export const Patcher = patcher.createPatcher('astral.translate');
