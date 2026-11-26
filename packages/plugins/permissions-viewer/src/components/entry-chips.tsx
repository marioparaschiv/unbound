import { metro } from '@unbound-app/api';
import { View } from 'react-native';

import useScrollEdges from '~/components/use-scroll-edges';
import type { PermissionsView } from '~/lib/views';
import EntryChip from '~/components/entry-chip';
import EdgeFade from '~/components/edge-fade';

import useStyles from '~/components/permissions-sheet.style';

type EntryChipsProps = {
	view: PermissionsView;
	selectedIndex: number;
	onSelect: (index: number) => void;
};

/**
 * @description The sheet's entries as one sideways-scrolling line of chips, with a scroll shadow over each end while chips hide past it.
 * @param props The view, the selected entry and what selecting one does.
 * @returns The chip row.
 */
function EntryChips({ view, selectedIndex, onSelect }: EntryChipsProps) {
	const styles = useStyles();
	const { edges, handlers } = useScrollEdges();
	// Gesture-handler's scroll view takes part in the sheet's gesture arbitration; React Native's loses sideways drags to it on Android.
	const { ScrollView } = metro.common.Gestures;

	return (
		<View>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.chips}
				{...handlers}
			>
				{view.entries.map((entry, index) => (
					<EntryChip
						key={`${entry.type}-${entry.id ?? 'owner'}`}
						entry={entry}
						selected={index === selectedIndex}
						view={view}
						onSelect={() => onSelect(index)}
					/>
				))}
			</ScrollView>
			<EdgeFade side='start' visible={edges.start} />
			<EdgeFade side='end' visible={edges.end} />
		</View>
	);
}

export default EntryChips;
