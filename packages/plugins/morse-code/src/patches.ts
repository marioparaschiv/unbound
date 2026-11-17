import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { dialogs, metro, patcher } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { decodeMorse, isMorse } from '~/lib/morse';
import type { MorsePlayer } from '~/lib/playback';

type SheetProps = { message?: { content?: string } };

/**
 * @description Adds Decode Morse and Play Morse to the long-press sheet of a message written in Morse code.
 * @param player Plays Morse code as sound or vibration.
 */
export function patchActionSheets(player: MorsePlayer): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Morse rows skipped: Discord moved ActionSheets.');

		return;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		const content = props.message?.content;

		if (!key.endsWith('MessageLongPressActionSheet') || !isMorse(content)) return;

		return (result) => {
			insertSheetRows(result, [
				{
					key: 'unbound-morse-decode',
					label: messages.DECODE,
					icon: 'LanguageIcon',
					onPress: () => {
						ActionSheets.hideActionSheet(key);
						dialogs.showDialog({
							title: messages.DECODED_TITLE,
							body: decodeMorse(content!),
							buttons: [{ label: messages.CLOSE }],
						});
					},
				},
				{
					key: 'unbound-morse-play',
					label: messages.PLAY,
					icon: 'PlayIcon',
					onPress: () => {
						ActionSheets.hideActionSheet(key);
						void player.play(content!);
					},
				},
			]);

			return result;
		};
	});
}
