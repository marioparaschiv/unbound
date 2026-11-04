import { flux, metro } from '@unbound-app/api';

export const ActionSheets = metro.api.ActionSheets;
export const ContextMenus = metro.findByProps('showContextMenu', 'hideContextMenu');

export const ChannelStore = flux.getStore('Channel');
export const UserProfileStore = flux.getStore('UserProfile');
export const UserStore = flux.getStore('User');
export const GuildStore = flux.getStore('Guild');

/** Discord's hashed message ID for "View Main Profile", the label of the profile overflow menu item; the same in every locale. */
const VIEW_MAIN_PROFILE_MESSAGE = 'GISTta';

/**
 * @description Reads Discord's "View Main Profile" label in the user's language, which is how its profile overflow item is told apart.
 * @returns The label, or nothing when Discord's i18n module or the message is missing.
 */
export function getViewMainProfileLabel(): string | undefined {
	const { i18n } = metro.common;
	const message = i18n.t?.[VIEW_MAIN_PROFILE_MESSAGE];

	if (!message) return;

	try {
		return i18n.intl.string(message);
	} catch (error) {
		logger.error('Failed to read the View Main Profile label:', error);
	}
}
