import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';

import { combineCleanups, forceProps, forceRowFields, forceUserSetting } from '~/patches/force';

function enable(): () => void {
	return combineCleanups([
		forceUserSetting('AnimateEmoji', true),
		forceRowFields(() => ({ animateEmoji: true })),
		forceProps('modules/activity_status/native/ActivityEmoji.tsx', { animate: true }),
	]);
}

/**
 * @description Animates custom emojis everywhere while the `emojis` setting is on: messages, reactions, custom statuses and pickers.
 * Makes Discord's `AnimateEmoji` user setting read as on, sets `animateEmoji` on the options of `generateMessageRowData`, and sets `animate` on the custom status `ActivityEmoji`.
 */
export function animateEmojis(): void {
	whileEnabled('emojis', enable);
}
