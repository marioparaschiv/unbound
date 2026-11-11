import { patcher } from '@unbound-app/api';

import { animateProfileEffects } from '~/patches/profile-effects';
import { animateDecorations } from '~/patches/decorations';
import { animateNameplates } from '~/patches/nameplates';
import { animateStickers } from '~/patches/stickers';
import { animateServers } from '~/patches/servers';
import { animateAvatars } from '~/patches/avatars';
import { animateEmojis } from '~/patches/emojis';
import { animateGifs } from '~/patches/gifs';

// Each part follows its own setting while the plugin runs, and an unpatchable component costs only that component.
export function start() {
	animateAvatars();
	animateDecorations();
	animateNameplates();
	animateProfileEffects();
	animateServers();
	animateEmojis();
	animateStickers();
	animateGifs();
}

export function stop() {
	patcher.unpatchAll();
}
