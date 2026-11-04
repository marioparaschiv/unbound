import { metro } from '@unbound-app/api';

export const Messages = metro.findByProps('sendMessage', 'receiveMessage');
