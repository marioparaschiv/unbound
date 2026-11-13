import { patcher } from '@unbound-app/api';

import { interceptReceivedMessages } from '~/flux/interceptors';
import { patchEmojiSending, patchEmojiUnlocks } from '~/patches/emojis';
import { patchStickerSending, patchStickerUnlocks } from '~/patches/stickers';

export function start() {
	patchEmojiUnlocks();
	patchEmojiSending();
	patchStickerUnlocks();
	patchStickerSending();
	interceptReceivedMessages();
}

export function stop() {
	patcher.unpatchAll();
}
