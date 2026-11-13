import { patcher } from '@unbound-app/api';

import { patchEmojiSending, patchEmojiUnlocks } from '~/patches/emojis';
import { patchStickerSending, patchStickerUnlocks } from '~/patches/stickers';

export function start() {
	patchEmojiUnlocks();
	patchEmojiSending();
	patchStickerUnlocks();
	patchStickerSending();
}

export function stop() {
	patcher.unpatchAll();
}
