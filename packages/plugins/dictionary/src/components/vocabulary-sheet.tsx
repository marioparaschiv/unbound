import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { toasts } from '@unbound-app/api';

import { toggleWord, useVocabulary } from '~/lib/vocabulary';
import { openDefinition } from '~/lib/sheets';

type VocabularySheetProps = { onClose: () => void };

/**
 * @description Lists the saved words with their first definition: tapping one opens it, long-pressing removes it.
 * @param props Closes the sheet.
 * @returns The sheet.
 */
export default function VocabularySheet({ onClose }: VocabularySheetProps) {
	const words = useVocabulary();
	const ActionSheetRow = getActionSheetRow();

	return (
		<Discord.ActionSheet>
			<Discord.Text
				variant='heading-lg/semibold'
				style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}
			>
				{messages.VOCABULARY}
			</Discord.Text>
			<Discord.Text
				variant='text-sm/medium'
				color='text-muted'
				style={{ paddingHorizontal: 16, paddingBottom: 12 }}
			>
				{words.length ? messages.VOCABULARY_HINT : messages.VOCABULARY_EMPTY}
			</Discord.Text>
			{words.length ? (
				<ActionSheetRow.Group>
					{words.map((entry) => (
						<ActionSheetRow
							key={entry.word}
							label={entry.word}
							subLabel={entry.gloss}
							onPress={() => {
								onClose();
								openDefinition(entry.word);
							}}
							onLongPress={() => {
								toggleWord(entry.word, entry.gloss);
								toasts.info('REMOVED');
							}}
						/>
					))}
				</ActionSheetRow.Group>
			) : null}
		</Discord.ActionSheet>
	);
}
