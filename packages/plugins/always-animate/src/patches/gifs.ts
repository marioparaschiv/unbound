import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';

import { combineCleanups, forceRowFields, forceUserSetting } from '~/patches/force';

function enable(): () => void {
	return combineCleanups([
		forceUserSetting('GifAutoPlay', true),
		forceRowFields(() => ({ gifAutoPlay: true })),
	]);
}

/**
 * @description Plays GIFs on their own, without tapping them, while the `gifs` setting is on.
 * Makes Discord's `GifAutoPlay` user setting read as on, and sets `gifAutoPlay` on the options of `generateMessageRowData`.
 */
export function animateGifs(): void {
	whileEnabled('gifs', enable);
}
