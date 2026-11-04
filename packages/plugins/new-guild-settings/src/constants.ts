export const PLUGIN_NAME = 'New Guild Settings';

export const PLUGIN_ID = 'unbound.new-guild-settings';

export const MessageNotifications = {
	All: 0,
	Mentions: 1,
	Nothing: 2,
	ServerDefault: 3,
} as const;

export type MessageNotification = (typeof MessageNotifications)[keyof typeof MessageNotifications];

export const HIGHLIGHTS_DISABLED = 1;

export const HIGHLIGHTS_UNSET = 0;

export const DEFAULTS = {
	guild: true,
	messages: MessageNotifications.ServerDefault as MessageNotification,
	everyone: true,
	role: true,
	highlights: true,
	events: true,
	showAllChannels: true,
};

export type NewGuildSettings = typeof DEFAULTS;

export type SettingKey = keyof NewGuildSettings;

export const REPEAT_WINDOW_MS = 10_000;

export const MENU_ROW_KEY = 'unbound-new-guild-settings-apply';
