import { patcher } from '@unbound-app/api';

import { interceptReceivedMessages } from '~/flux/interceptors';
import { patchEmojiEditing, patchEmojiSending, patchEmojiUnlocks } from '~/patches/emojis';
import { patchStickerSending, patchStickerUnlocks } from '~/patches/stickers';

export function start() {
	patchEmojiUnlocks();
	patchEmojiSending();
	patchEmojiEditing();
	patchStickerUnlocks();
	patchStickerSending();
	interceptReceivedMessages();
}

export function stop() {
	patcher.unpatchAll();
}
