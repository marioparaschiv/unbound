import { flux, metro, storage } from '@unbound-app/api';

export const DiscordConstants = metro.findByProps('Permissions', 'ThemeTypes');
export const PermissionUtils = metro.findByProps('computePermissions', 'canEveryoneRole');
export const TagProperties = metro.findByName('getTagProperties', { interop: false });
export const GuildMemberStore = flux.getStore('GuildMember');
export const ChannelStore = flux.getStore('Channel');
export const GuildStore = flux.getStore('Guild');

// Holds the cached tag colors, which are data, not a setting.
export const bucket = storage.getBucket();
