import { Dimensions, View } from 'react-native';
import { useEffect, useMemo } from 'react';

import type { TagMatch } from '~/marketplace/filters';
import { Discord } from '~/metro/components';

import useStyles from './match-control.style';

type MatchControlProps<M extends TagMatch> = {
	value: M;
	/** The operators in segment order, such as `['any', 'none']`. */
	matches: readonly M[];
	/** One label per operator, such as Include and Exclude. */
	labels: readonly string[];
	/** Dims the control while its filter has nothing picked. */
	disabled?: boolean;
	onChange: (match: M) => void;
};

/**
 * @description Discord's segmented control over a filter's operators, such as keeping or dropping what it picks.
 */
function MatchControl<M extends TagMatch>({
	value,
	matches,
	labels,
	disabled = false,
	onChange,
}: MatchControlProps<M>) {
	const styles = useStyles();
	const picked = matches.indexOf(value);
	const items = useMemo(
		() => matches.map((match, index) => ({ id: match, label: labels[index] })),
		[matches, labels],
	);
	const state = Discord.useSegmentedControlState({
		items,
		pageWidth: Dimensions.get('window').width,
		defaultIndex: picked,
		onSetActiveIndex(index: number) {
			const next = matches[index];

			if (next && next !== value) {
				onChange(next);
			}
		},
	});

	useEffect(() => {
		if (state.activeIndex !== picked) {
			state.setActiveIndex(picked);
		}
	}, [picked]);

	return (
		<View pointerEvents={disabled ? 'none' : 'auto'} style={disabled ? styles.disabled : null}>
			<Discord.SegmentedControl state={state} />
		</View>
	);
}

export default MatchControl;
