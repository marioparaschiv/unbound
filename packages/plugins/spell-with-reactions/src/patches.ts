import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { metro, patcher } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { openSpellSheet } from '~/components/spell-sheet';

const SHEET_SWAP_MS = 350;

type Reaction = { emoji?: { id?: string | null; name?: string }; me?: boolean };
type SheetProps = { message?: { id?: string; channel_id?: string; reactions?: Reaction[] } };

function unicodeReactions(reactions: Reaction[] = []): string[] {
	return reactions.flatMap(({ emoji }) => (!emoji?.id && emoji?.name ? [emoji.name] : []));
}

/**
 * @description Adds a Spell With Reactions row to the message long-press action sheet.
 */
export function patchActionSheets(): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Spell With Reactions row skipped: Discord moved ActionSheets.');

		return;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		const { id: messageId, channel_id: channelId, reactions } = props.message ?? {};

		if (!key.endsWith('MessageLongPressActionSheet') || !messageId || !channelId) return;

		return (result) => {
			insertSheetRows(result, [
				{
					key: 'unbound-spell-with-reactions',
					label: messages.SPELL,
					icon: 'ReactionIcon',
					onPress: () => {
						ActionSheets.hideActionSheet(key);
						setTimeout(
							() =>
								openSpellSheet({
									channelId,
									messageId,
									taken: unicodeReactions(reactions),
								}),
							SHEET_SWAP_MS,
						);
					},
				},
			]);

			return result;
		};
	});
}
