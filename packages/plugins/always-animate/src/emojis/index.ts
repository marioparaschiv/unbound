import { combineCleanups, forceProps, forceRowFields, forceUserSetting } from '~/force/patches';
import { ActivityEmoji } from '~/emojis/modules';

/**
 * @description Animates custom emojis everywhere: messages, reactions, custom statuses and pickers.
 * Makes Discord's `AnimateEmoji` user setting read as on, sets `animateEmoji` on the options of `generateMessageRowData`, and sets `animate` on the custom status `ActivityEmoji`.
 * @returns A function that removes the patches.
 */
export function animateEmojis(): () => void {
	return combineCleanups([
		forceUserSetting('AnimateEmoji', true),
		forceRowFields(() => ({ animateEmoji: true })),
		forceProps(ActivityEmoji, { animate: true }),
	]);
}
