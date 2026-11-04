import { flux, metro } from '@unbound-app/api';

export const ActionSheets = metro.api.ActionSheets;
export const ContextMenus = metro.findByProps('showContextMenu', 'hideContextMenu');

export const ChannelStore = flux.getStore('Channel');
export const UserProfileStore = flux.getStore('UserProfile');
export const UserStore = flux.getStore('User');
export const GuildStore = flux.getStore('Guild');

/** Discord's hashed message ID for "View Main Profile", the label of the profile overflow menu item; the same in every locale. */
const VIEW_MAIN_PROFILE_MESSAGE = 'GISTta';

const ENGLISH_VIEW_MAIN_PROFILE = 'View Main Profile';

/**
 * @description Reads Discord's "View Main Profile" label in the user's language, which is how its profile overflow item is told apart.
 * @returns The label, or the English one when Discord's i18n module or the message is missing, such as after the id was renamed.
 */
export function getViewMainProfileLabel(): string {
	const { i18n } = metro.common;
	const message = i18n.t?.[VIEW_MAIN_PROFILE_MESSAGE];

	if (!message) return ENGLISH_VIEW_MAIN_PROFILE;

	try {
		return i18n.intl.string(message);
	} catch (error) {
		logger.error('Failed to read the View Main Profile label:', error);

		return ENGLISH_VIEW_MAIN_PROFILE;
	}
}
