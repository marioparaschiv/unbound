import type { FluxChannel, FluxGuild, FluxStore, FluxUser } from '@unbound-app/api/flux';

import type { Overwrite, Role } from '~/viewer/permissions/model';

export type GuildRole = Role & {
	icon?: string | null;
	unicodeEmoji?: string | null;
};

export type GuildRoleStore = FluxStore & {
	getSortedRoles?(guildId: string): GuildRole[] | null | undefined;
	getRolesSnapshot?(guildId: string): Record<string, GuildRole> | null | undefined;
	getRole?(guildId: string, roleId: string): GuildRole | null | undefined;
};

export type Guild = FluxGuild & {
	roles?: Record<string, GuildRole>;
};

export type Channel = FluxChannel & {
	permissionOverwrites?: Record<string, Overwrite>;
};

export type User = FluxUser & {
	getAvatarURL?(guildId?: string, size?: number, animated?: boolean): string | undefined;
};

export type PermissionSpec = {
	title?: unknown;
	description?: unknown;
};

export type PermissionSpecModule = {
	getGuildPermissionSpecMap?(guild: Guild): Record<string, PermissionSpec> | null | undefined;
};
