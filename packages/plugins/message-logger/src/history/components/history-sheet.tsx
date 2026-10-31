import { Discord } from '@unbound-app/api/metro/components';
import { ScrollView, View } from 'react-native';

import type { EditEntry } from '~/log';

type HistorySheetProps = {
	current: string;
	edits: readonly EditEntry[];
};

type VersionProps = {
	label: string;
	content: string;
};

function formatTime(timestamp: string): string {
	const date = new Date(timestamp);

	return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString();
}

function Version({ label, content }: VersionProps) {
	return (
		<View style={{ gap: 4 }}>
			<Discord.Text variant='text-xs/semibold' color='text-muted'>
				{label}
			</Discord.Text>
			<Discord.Text variant='text-md/normal' selectable>
				{content || '(empty)'}
			</Discord.Text>
		</View>
	);
}

/**
 * @description Lists a message's earlier versions, oldest first, then its current text.
 * @param props The current text and the logged edits.
 * @returns The sheet.
 */
export function HistorySheet({ current, edits }: HistorySheetProps) {
	return (
		<Discord.ActionSheet startExpanded>
			<ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: 16, padding: 16 }}>
				<Discord.Text variant='text-lg/semibold'>Message History</Discord.Text>
				{edits.map((edit, index) => (
					<Version
						key={`${edit.timestamp}-${index}`}
						label={`Before the edit at ${formatTime(edit.timestamp)}`}
						content={edit.content}
					/>
				))}
				<Version label='Current' content={current} />
			</ScrollView>
		</Discord.ActionSheet>
	);
}

export default HistorySheet;
