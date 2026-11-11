import { flux, metro } from '@unbound-app/api';

export { Media } from '@unbound-app/api/metro/components';

export const IconUtils = metro.findByProps('getUserAvatarURL', 'getGuildIconURL');
export const { Theme } = metro.common;

export const ChannelStore = flux.getStore('Channel');
export const GuildMemberStore = flux.getStore('GuildMember');
export const UserProfileStore = flux.getStore('UserProfile');
export const UserStore = flux.getStore('User');
export const GuildStore = flux.getStore('Guild');
