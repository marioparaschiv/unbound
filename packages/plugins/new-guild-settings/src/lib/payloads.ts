import type { Settings } from '@unbound-app/settings';

import { HIGHLIGHTS_DISABLED, HIGHLIGHTS_UNSET, MESSAGE_NOTIFICATIONS } from '~/lib/constants';

export type NotificationUpdate = {
	muted?: boolean;
	suppress_everyone?: boolean;
	suppress_roles?: boolean;
	mute_scheduled_events?: boolean;
	notify_highlights?: number;
	message_notifications?: number;
};

/**
 * @description Builds the guild notification updates Vencord's NewGuildSettings sends, in the same order.
 * @param settings The settings to apply.
 * @returns The updates, the second one only when a message notification level other than the server default is chosen.
 */
export function buildNotificationUpdates(settings: Settings): NotificationUpdate[] {
	const updates: NotificationUpdate[] = [
		{
			muted: settings.guild,
			suppress_everyone: settings.everyone,
			suppress_roles: settings.role,
			mute_scheduled_events: settings.events,
			notify_highlights: settings.highlights ? HIGHLIGHTS_DISABLED : HIGHLIGHTS_UNSET,
		},
	];

	if (settings.messages !== 'serverDefault') {
		updates.push({ message_notifications: MESSAGE_NOTIFICATIONS[settings.messages] });
	}

	return updates;
}

/**
 * @description Tells whether a value is the ID of a server the settings can be applied to.
 * @param guildId A value Discord passed as a guild ID.
 * @returns `true` for a non-empty ID other than the DM pseudo-guild.
 */
export function isApplicableGuildId(guildId: unknown): guildId is string {
	return typeof guildId === 'string' && guildId !== '' && guildId !== '@me' && guildId !== 'null';
}

export default { buildNotificationUpdates, isApplicableGuildId };
