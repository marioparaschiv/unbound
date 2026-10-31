import type { Tag } from '~/tags';

export const HEX_COLOR = /^#[\da-f]{6}$/i;

/** Checked in order; a user gets the first enabled tag they qualify for. */
export const TAGS: Tag[] = [
	{
		name: 'WEBHOOK',
		color: '#5865F2',
		displayName: 'Webhook',
		description: 'Messages sent by webhooks',
		condition: (message, user) => Boolean(message.webhookId) && Boolean(user.bot),
	},
	{
		name: 'OWNER',
		color: '#F0B232',
		displayName: 'Owner',
		description: 'Owns the server',
		condition: (_message, user, guild) => guild?.ownerId === user.id,
	},
	{
		name: 'ADMINISTRATOR',
		color: '#DA373C',
		displayName: 'Admin',
		description: 'Has the administrator permission',
		permissions: ['ADMINISTRATOR'],
	},
	{
		name: 'MODERATOR_STAFF',
		color: '#248046',
		displayName: 'Staff',
		description: 'Can manage the server, channels or roles',
		permissions: ['MANAGE_GUILD', 'MANAGE_CHANNELS', 'MANAGE_ROLES', 'MANAGE_WEBHOOKS'],
	},
	{
		name: 'MODERATOR',
		color: '#4E7FFF',
		displayName: 'Mod',
		description: 'Can manage messages or kick/ban people',
		permissions: ['MANAGE_MESSAGES', 'KICK_MEMBERS', 'BAN_MEMBERS'],
	},
	{
		name: 'VOICE_MODERATOR',
		color: '#059669',
		displayName: 'VC Mod',
		description: 'Can manage voice chats',
		permissions: ['MOVE_MEMBERS', 'MUTE_MEMBERS', 'DEAFEN_MEMBERS'],
	},
];
