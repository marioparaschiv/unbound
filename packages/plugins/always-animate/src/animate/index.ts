import type { Feature } from '@unbound-plugins/shared/lifecycle/features';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';
import type { SettingKey } from '@unbound-app/settings';

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
 * @returns One feature per part, each removing it and its listener when it ends.
 */
export function animateFeatures(): Feature[] {
	return (Object.keys(FEATURES) as SettingKey[]).map(
		(key) => () => whileEnabled(key, FEATURES[key]),
	);
}
