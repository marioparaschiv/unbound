import {
	DEFAULTS,
	HIGHLIGHTS_DISABLED,
	HIGHLIGHTS_UNSET,
	MessageNotifications,
	type MessageNotification,
	type NewGuildSettings,
} from '~/constants';

export type NotificationUpdate = {
	muted?: boolean;
	suppress_everyone?: boolean;
	suppress_roles?: boolean;
	mute_scheduled_events?: boolean;
	notify_highlights?: number;
	message_notifications?: number;
};

type SettingsReader = { get: (key: string, def: unknown) => unknown };

const MESSAGE_VALUES = new Set<number>(Object.values(MessageNotifications));

function isMessageNotification(value: unknown): value is MessageNotification {
	return typeof value === 'number' && MESSAGE_VALUES.has(value);
}

/**
 * @description Reads every setting from the plugin's bucket, falling back to the default for a missing or malformed value.
 * @param bucket The plugin's settings bucket.
 * @returns The settings to apply.
 */
export function readSettings(bucket: SettingsReader): NewGuildSettings {
	const read = (key: Exclude<keyof NewGuildSettings, 'messages'>) => {
		const value = bucket.get(key, DEFAULTS[key]);

		return typeof value === 'boolean' ? value : DEFAULTS[key];
	};
	const messages = bucket.get('messages', DEFAULTS.messages);

	return {
		guild: read('guild'),
		messages: isMessageNotification(messages) ? messages : DEFAULTS.messages,
		everyone: read('everyone'),
		role: read('role'),
		highlights: read('highlights'),
		events: read('events'),
		showAllChannels: read('showAllChannels'),
	};
}

/**
 * @description Builds the guild notification updates Vencord's NewGuildSettings sends, in the same order.
 * @param settings The settings to apply.
 * @returns The updates, the second one only when a message notification level other than the server default is chosen.
 */
export function buildNotificationUpdates(settings: NewGuildSettings): NotificationUpdate[] {
	const updates: NotificationUpdate[] = [
		{
			muted: settings.guild,
			suppress_everyone: settings.everyone,
			suppress_roles: settings.role,
			mute_scheduled_events: settings.events,
			notify_highlights: settings.highlights ? HIGHLIGHTS_DISABLED : HIGHLIGHTS_UNSET,
		},
	];

	if (settings.messages !== MessageNotifications.ServerDefault) {
		updates.push({ message_notifications: settings.messages });
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

export default { readSettings, buildNotificationUpdates, isApplicableGuildId };
