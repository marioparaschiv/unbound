import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';
import type { SettingKey } from '@unbound-app/settings';
import { storage } from '@unbound-app/api';

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
 * Each part patches what its own folder names. The Addon scope removes the patches and the settings listener when the plugin stops.
 */
export function startAnimate(): void {
	const bucket = storage.getBucket();

	for (const key of Object.keys(FEATURES) as SettingKey[]) {
		whileEnabled(bucket, key, true, FEATURES[key]);
	}
}
