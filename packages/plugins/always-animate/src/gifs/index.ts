import { combineCleanups, forceRowFields, forceUserSetting } from '~/force/patches';

/**
 * @description Plays GIFs on their own, without tapping them.
 * Makes Discord's `GifAutoPlay` user setting read as on, and sets `gifAutoPlay` on the options of `generateMessageRowData`.
 * @returns A function that removes the patches.
 */
export function animateGifs(): () => void {
	return combineCleanups([
		forceUserSetting('GifAutoPlay', true),
		forceRowFields(() => ({ gifAutoPlay: true })),
	]);
}
