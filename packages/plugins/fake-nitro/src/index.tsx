import { patcher } from '@unbound-app/api';

import { interceptReceivedMessages } from '~/flux/interceptors';
import { patchEmojiEditing, patchEmojiSending, patchEmojiUnlocks } from '~/patches/emojis';
import { patchStickerSending, patchStickerUnlocks } from '~/patches/stickers';
import { patchStreamQuality } from '~/patches/streaming';

export function start() {
	patchEmojiUnlocks();
	patchEmojiSending();
	patchEmojiEditing();
	patchStickerUnlocks();
	patchStickerSending();
	interceptReceivedMessages();
	patchStreamQuality();
}

export function stop() {
	patcher.unpatchAll();
}
