import { patchEmojiPicker, patchStickerPicker } from '~/patches';

export function start() {
	patchEmojiPicker();
	patchStickerPicker();
}
