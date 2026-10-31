import { metro, storage, flux } from '@unbound-app/api';

export const DiscordConstants = metro.findByProps('Permissions', 'ThemeTypes', { lazy: true });
export const PermissionUtils = metro.findByProps('computePermissions', 'canEveryoneRole', {
	lazy: true,
});
export const TagProperties = metro.findByName('getTagProperties', { interop: false, lazy: true });
export const byTagProperties = metro.filters.byName('getTagProperties');
export const GuildMemberStore = flux.getStore('GuildMember', { lazy: true });
export const ChannelStore = flux.getStore('Channel', { lazy: true });
export const GuildStore = flux.getStore('Guild', { lazy: true });

export const settings = storage.getBucket();
