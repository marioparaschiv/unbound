import { BottomSheets, Discord, GorhomSheet } from '@unbound-app/api/metro/components';
import { format, messages } from '@unbound-app/i18n';

import useStyles from '~/components/history-sheet.style';
import type { EditEntry } from '~/lib/log';

// Enough lines for a long message, which a table row would otherwise cut to one.
const FULL_TEXT_LINES = 40;

type HistorySheetProps = {
	current: string;
	edits: readonly EditEntry[];
};

function formatTime(timestamp: string): string {
	const date = new Date(timestamp);

	return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString();
}

/**
 * @description Lists a message's earlier versions, oldest first, then its current text, as rows of one table.
 * @param props The current text and the logged edits.
 * @returns The sheet.
 */
export function HistorySheet({ current, edits }: HistorySheetProps) {
	const styles = useStyles();
	const { ActionSheet, BottomSheetTitleHeader } = BottomSheets;
	const { BottomSheetScrollView: ScrollView } = GorhomSheet;

	return (
		<ActionSheet scrollable startExpanded>
			<BottomSheetTitleHeader title={messages.HISTORY_TITLE} />
			<ScrollView contentContainerStyle={styles.body}>
				<Discord.TableRowGroup>
					{edits.map((edit, index) => (
						<Discord.TableRow
							key={`${edit.timestamp}-${index}`}
							label={edit.content || messages.EMPTY_MESSAGE}
							labelLineClamp={FULL_TEXT_LINES}
							subLabel={format('BEFORE_EDIT', { time: formatTime(edit.timestamp) })}
						/>
					))}
					<Discord.TableRow
						label={current || messages.EMPTY_MESSAGE}
						labelLineClamp={FULL_TEXT_LINES}
						subLabel={messages.CURRENT_VERSION}
					/>
				</Discord.TableRowGroup>
			</ScrollView>
		</ActionSheet>
	);
}

export default HistorySheet;
