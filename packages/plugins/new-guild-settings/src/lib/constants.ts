import type { SettingsEntry } from '@unbound-app/settings';

/** Discord's message notification level for each choice of the `messages` setting. */
export const MESSAGE_NOTIFICATIONS: Record<SettingsEntry<'messages'>, number> = {
	all: 0,
	mentions: 1,
	nothing: 2,
	serverDefault: 3,
};

export const HIGHLIGHTS_DISABLED = 1;

export const HIGHLIGHTS_UNSET = 0;

export const REPEAT_WINDOW_MS = 10_000;

export const MENU_ROW_KEY = 'unbound-new-guild-settings-apply';
