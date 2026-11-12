import { messages } from '@unbound-app/i18n';

import type { Tag } from '~/lib/types';

export const HEX_COLOR = /^#[\da-f]{6}$/i;

/** Checked in order; a user gets the first enabled tag they qualify for. */
export const TAGS: Tag[] = [
	{
		name: 'WEBHOOK',
		color: '#5865F2',
		displayName: () => messages.TAG_WEBHOOK,
		condition: (message, user) => Boolean(message.webhookId) && Boolean(user.bot),
	},
	{
		name: 'OWNER',
		color: '#F0B232',
		displayName: () => messages.TAG_OWNER,
		condition: (_message, user, guild) => guild?.ownerId === user.id,
	},
	{
		name: 'ADMINISTRATOR',
		color: '#DA373C',
		displayName: () => messages.TAG_ADMINISTRATOR,
		permissions: ['ADMINISTRATOR'],
	},
	{
		name: 'MODERATOR_STAFF',
		color: '#248046',
		displayName: () => messages.TAG_MODERATOR_STAFF,
		permissions: ['MANAGE_GUILD', 'MANAGE_CHANNELS', 'MANAGE_ROLES', 'MANAGE_WEBHOOKS'],
	},
	{
		name: 'MODERATOR',
		color: '#4E7FFF',
		displayName: () => messages.TAG_MODERATOR,
		permissions: ['MANAGE_MESSAGES', 'KICK_MEMBERS', 'BAN_MEMBERS'],
	},
	{
		name: 'VOICE_MODERATOR',
		color: '#059669',
		displayName: () => messages.TAG_VOICE_MODERATOR,
		permissions: ['MOVE_MEMBERS', 'MUTE_MEMBERS', 'DEAFEN_MEMBERS'],
	},
];
