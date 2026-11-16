import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { messages } from '@unbound-app/i18n';
import { metro, patcher } from '@unbound-app/api';

import { openWords } from '~/lib/sheets';
import { wordsIn } from '~/lib/words';

type SheetProps = { message?: { content?: string } };

/**
 * @description Adds Define Words to the message long-press action sheet for messages with text, which lists the
 * message's words to look up.
 */
export function patchActionSheets(): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Define Words skipped: Discord moved ActionSheets.');

		return;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		const content = props.message?.content;

		if (!key.endsWith('MessageLongPressActionSheet') || !content?.trim()) return;

		return (result) => {
			insertSheetRows(result, [
				{
					key: 'unbound-dictionary',
					label: messages.DEFINE_WORDS,
					icon: 'BookCheckIcon',
					onPress: () => {
						ActionSheets.hideActionSheet(key);
						openWords(wordsIn(content));
					},
				},
			]);

			return result;
		};
	});
}

export default { patchActionSheets };
