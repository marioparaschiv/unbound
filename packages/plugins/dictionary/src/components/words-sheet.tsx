import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';

import { openDefinition } from '~/lib/sheets';

type WordsSheetProps = { words: string[]; onClose: () => void };

/**
 * @description Lists a message's words; tapping one opens its definition.
 * @param props The words and a way to close the sheet.
 * @returns The sheet.
 */
export default function WordsSheet({ words, onClose }: WordsSheetProps) {
	const ActionSheetRow = getActionSheetRow();

	return (
		<Discord.ActionSheet>
			<Discord.Text
				variant='heading-lg/semibold'
				style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}
			>
				{words.length ? messages.PICK_WORD : messages.NO_WORDS}
			</Discord.Text>
			<ActionSheetRow.Group>
				{words.map((word) => (
					<ActionSheetRow
						key={word}
						label={word}
						onPress={() => {
							onClose();
							openDefinition(word);
						}}
					/>
				))}
			</ActionSheetRow.Group>
		</Discord.ActionSheet>
	);
}
