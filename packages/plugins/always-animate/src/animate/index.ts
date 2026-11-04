import startFeatures from '@unbound-plugins/shared/lifecycle/start-features';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';
import { settings, type SettingKey } from '@unbound-app/settings';

import { animateDecorations } from '~/decorations';
import { animateNameplates } from '~/nameplates';
import { animateProfileEffects } from '~/profile-effects';
import { animateStickers } from '~/stickers';
import { animateServers } from '~/servers';
import { animateAvatars } from '~/avatars';
import { animateEmojis } from '~/emojis';
import { animateGifs } from '~/gifs';

const FEATURES: Record<SettingKey, () => () => void> = {
	avatars: animateAvatars,
	decorations: animateDecorations,
	nameplates: animateNameplates,
	profileEffects: animateProfileEffects,
	servers: animateServers,
	emojis: animateEmojis,
	stickers: animateStickers,
	gifs: animateGifs,
};

/**
 * @description Turns each part on while its setting is on, and off again when the user switches it off.
 * Each part patches what its own folder names, and one that throws only costs that part.
 * @returns A function that removes every part and stops listening; call it in `stop` so the self test counts them out.
 */
export function startAnimate(): () => Promise<void> {
	return startFeatures(
		'Always Animate',
		(Object.keys(FEATURES) as SettingKey[]).map(
			(key) => () => whileEnabled(settings, key, true, FEATURES[key]),
		),
	);
}
