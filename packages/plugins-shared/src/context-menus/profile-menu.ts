import { metro } from '@unbound-app/api';

// Discord's own messages for the rows of a user profile's overflow menu, each with its English text.
// The menu carries no user, so its rows' labels, read in the user's language, recognize it.
const PROFILE_MENU_MESSAGES: Record<string, string> = {
	GISTta: 'View Main Profile',
	DisZzB: 'View Server Profile',
	y5MwJy: 'Copy Username',
	QvQeLv: 'Copy User ID',
	BGYkaH: 'Set Friend Nickname',
	TbHyMG: 'Report',
};

function discordText(id: string, english: string): string {
	try {
		const { i18n } = metro.common;
		const message = i18n.t?.[id];

		return message === undefined ? english : i18n.intl.formatToPlainString(message, {});
	} catch {
		// This build of Discord cannot format the message, so the English text stands in for it.
		return english;
	}
}

/**
 * @description Recognizes the overflow menu of a user's profile by its rows' labels, in whatever language Discord shows.
 * Reads Discord's own messages `GISTta`, `DisZzB`, `y5MwJy`, `QvQeLv`, `BGYkaH` and `TbHyMG` from `metro.common.i18n`, and falls back to their English text when Discord has no such message.
 * @param items The menu's rows.
 * @returns `true` when a row is one of the profile menu's.
 */
export function isProfileMenu(items: { label?: string }[] | undefined): boolean {
	const labels = new Set(
		Object.entries(PROFILE_MENU_MESSAGES).map(([id, english]) => discordText(id, english)),
	);

	return Boolean(items?.some((item) => item.label !== undefined && labels.has(item.label)));
}

export default isProfileMenu;
