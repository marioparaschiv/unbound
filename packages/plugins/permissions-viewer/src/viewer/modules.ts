import { flux, metro } from '@unbound-app/api';

import { ROLES_CARD_PATH } from '~/constants';
import type { GuildRoleStore as GuildRoles, PermissionSpecModule } from '~/types';

export const ActionSheets = metro.findByProps('openLazy', 'hideActionSheet');
export const Icons = metro.findByProps('ShieldUserIcon');
export const { Clipboard, Constants, i18n } = metro.common;
export const ContextMenus = metro.findByProps('showContextMenu', 'hideContextMenu');
export const RolesCard = metro.findByFilePath(ROLES_CARD_PATH);
export const PermissionSpecs = metro.findByProps(
	'getGuildPermissionSpecMap',
) as PermissionSpecModule;

export const GuildStore = flux.getStore('Guild');
export const GuildRoleStore = flux.getStore('GuildRole') as GuildRoles;
export const GuildMemberStore = flux.getStore('GuildMember');
export const ChannelStore = flux.getStore('Channel');
export const UserStore = flux.getStore('User');
