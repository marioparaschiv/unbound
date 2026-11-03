import { combineCleanups, forceProps, forceRowFields, forceUserSetting } from '~/force/patches';
import { ACTIVITY_EMOJI_PATH } from '~/constants';

/**
 * @description Animates custom emojis everywhere: messages, reactions, custom statuses and pickers.
 * Makes Discord's `AnimateEmoji` user setting read as on, sets `animateEmoji` on the options of `generateMessageRowData`, and sets `animate` on the custom status `ActivityEmoji`.
 * @returns A function that removes the patches.
 */
export function animateEmojis(): () => void {
	return combineCleanups([
		forceUserSetting('AnimateEmoji', true),
		forceRowFields(() => ({ animateEmoji: true })),
		forceProps(ACTIVITY_EMOJI_PATH, { animate: true }),
	]);
}
