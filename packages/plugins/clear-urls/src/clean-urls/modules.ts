import { metro } from '@unbound-app/api';

export const MessageActions = metro.findByProps('sendMessage', 'receiveMessage');
