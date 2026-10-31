import type { RoleColorStops } from '@unbound-plugins/shared/colors/role-colors';
import type { FluxStore } from '@unbound-app/api/flux';

export type Member = {
	userId: string;
	nick?: string | null;
	colorString?: string | null;
	colorStrings?: RoleColorStops | null;
	hoistRoleId?: string | null;
	colorRoleId?: string | null;
};

export type Role = {
	name?: string;
	colorString?: string | null;
	colorStrings?: RoleColorStops | null;
};

export type User = {
	id: string;
	username?: string;
	globalName?: string | null;
	discriminator?: string | null;
};

export type Message = {
	content?: string;
	guildId?: string;
};

export type Channel = {
	guild_id?: string;
};

export type MemberStore = {
	getMember(guildId: string, userId: string): Member | null | undefined;
	getMembers(guildId: string): Member[] | null | undefined;
	addChangeListener(listener: () => void): void;
	removeChangeListener(listener: () => void): void;
};

// Discord's render output has no published shape, so patches read it structurally and bail when it differs.
export type Rendered = any;

// Values bridged from Objective-C carry no static type; each caller checks the shape it reads.
export type NativeValue = any;

type GuildRoleStore = FluxStore & {
	getRole(guildId: string, roleId: string): Role | null | undefined;
};

type MessageStore = FluxStore & {
	getMessage(channelId: string, messageId: string): Message | null | undefined;
};

declare module '@unbound-app/api/flux' {
	interface FluxStores {
		GuildRole: GuildRoleStore;
		Message: MessageStore;
	}
}
