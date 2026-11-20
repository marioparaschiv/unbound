import { flux } from '@unbound-app/api';

export const UserStore = flux.getStore('User');
export const GuildStore = flux.getStore('Guild');
export const GuildMemberStore = flux.getStore('GuildMember');
export const GuildRoleStore = flux.getStore('GuildRole');
