import { flux, metro } from '@unbound-app/api';

export const MessageRowData = metro.findByProps('generateMessageRowData');
export const UserProfileStore = flux.getStore('UserProfile');
export const ChannelStore = flux.getStore('Channel');
export const MessageStore = flux.getStore('Message');
export const UserStore = flux.getStore('User');
