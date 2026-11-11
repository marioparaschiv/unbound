import { flux, metro } from '@unbound-app/api';

import type { GuildRoleStore as GuildRoles, PermissionSpecModule } from '~/lib/types';

// Read by every feature's sheets and rows, so they are looked up once for all of them.
export const { Clipboard, Constants, i18n } = metro.common;
export const PermissionSpecs = metro.findByProps('getGuildPermissionSpecMap') as
	| PermissionSpecModule
	| undefined;

export const GuildStore = flux.getStore('Guild');
export const GuildRoleStore = flux.getStore('GuildRole') as GuildRoles;
export const GuildMemberStore = flux.getStore('GuildMember');
export const ChannelStore = flux.getStore('Channel');
export const UserStore = flux.getStore('User');
