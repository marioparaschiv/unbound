import { metro, patcher, storage } from '@unbound-app/api';

export const DiscordConstants = metro.findByProps('Permissions', 'ThemeTypes', { lazy: true });
export const PermissionUtils = metro.findByProps('computePermissions', 'canEveryoneRole', {
	lazy: true,
});
export const TagProperties = metro.findByName('getTagProperties', { interop: false, lazy: true });
export const GuildMemberStore = metro.findStore('GuildMember', { lazy: true });
export const ChannelStore = metro.findStore('Channel', { lazy: true });
export const GuildStore = metro.stores.Guilds;

export const settings = storage.getStore('astral.more-user-tags');
export const Patcher = patcher.createPatcher('astral.more-user-tags');
