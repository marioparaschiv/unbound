import { PROFILE_MENU_MESSAGES } from '~/constants';
import { i18n } from '~/viewer/modules';

function discordText(id: string): string | undefined {
	try {
		const message = i18n.t?.[id];

		return message === undefined ? undefined : i18n.intl.formatToPlainString(message, {});
	} catch {
		// This build of Discord cannot format the message, so it recognizes no row by it.
		return undefined;
	}
}

/**
 * @description Recognizes the overflow menu of a user's profile by its rows' labels, in whatever language Discord shows.
 * Reads Discord's own messages `GISTta`, `DisZzB`, `y5MwJy` and `QvQeLv` from `metro.common.i18n`.
 * @param items The menu's rows.
 * @returns `true` when a row is one of the profile menu's.
 */
export function isProfileMenu(items: { label?: string }[] | undefined): boolean {
	const labels = new Set<string>();

	for (const id of PROFILE_MENU_MESSAGES) {
		const text = discordText(id);

		if (text) labels.add(text);
	}

	return Boolean(items?.some((item) => item.label !== undefined && labels.has(item.label)));
}
