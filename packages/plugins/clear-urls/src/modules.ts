import { metro, patcher } from '@unbound-app/api';

export const MessageActions = metro.api.Messages;

export const Patcher = patcher.createPatcher('unbound.clear-urls');
