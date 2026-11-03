import { flux, metro, storage } from '@unbound-app/api';

import type { GuildRoleStore as GuildRoles, PermissionSpecModule } from '~/types';

export const { ActionSheets } = metro.api;
export const { Clipboard, Constants, i18n } = metro.common;
export const ContextMenusFilter = metro.filters.byProps('showContextMenu', 'hideContextMenu');
export const PermissionSpecs = metro.findByProps('getGuildPermissionSpecMap', {
	lazy: true,
}) as PermissionSpecModule;

export const GuildStore = flux.getStore('Guild', { lazy: true });
export const GuildRoleStore = flux.getStore('GuildRole', { lazy: true }) as GuildRoles;
export const GuildMemberStore = flux.getStore('GuildMember', { lazy: true });
export const ChannelStore = flux.getStore('Channel', { lazy: true });
export const UserStore = flux.getStore('User', { lazy: true });

export const settings = storage.getBucket('unbound.permissions-viewer');
