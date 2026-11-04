import type { RoleColorStops } from '@unbound-plugins/shared/colors/role-colors';
import type { Settings } from '@unbound-app/settings';

export type TagGradients = {
	start: () => () => void;
	/** Resolves once every gradient layer is removed after `start`'s cleanup ran. */
	settled: () => Promise<void>;
	/** Reads back the gradients drawn on screen and lists the tags whose gradient is gone, colorless or empty. */
	problems: () => Promise<string[]>;
	drawn: () => number;
};

export type PermissionName =
	| 'ADMINISTRATOR'
	| 'MANAGE_GUILD'
	| 'MANAGE_CHANNELS'
	| 'MANAGE_ROLES'
	| 'MANAGE_WEBHOOKS'
	| 'MANAGE_MESSAGES'
	| 'KICK_MEMBERS'
	| 'BAN_MEMBERS'
	| 'MOVE_MEMBERS'
	| 'MUTE_MEMBERS'
	| 'DEAFEN_MEMBERS';

export type User = { id: string; bot?: boolean };
export type Guild = { id: string; ownerId: string };
export type Channel = { guild_id?: string | null; permissionOverwrites?: object };
export type Message = {
	id?: string;
	author?: User;
	channel_id: string;
	webhookId?: string;
	colorString?: string;
	colorStrings?: RoleColorStops;
};

type TagMatch =
	| { condition: (message: Message, user: User, guild: Guild | undefined) => boolean }
	| { permissions: PermissionName[] };

export type Tag = {
	/** The key of the tag's switch in the `tag` settings section. */
	name: keyof Settings['tag'];
	/** Reads the tag's text in the user's language. */
	displayName: () => string;
	color: string;
} & TagMatch;
