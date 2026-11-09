import { Dimensions, View } from 'react-native';
import { useEffect, useMemo } from 'react';

import type { FilterMatch } from '~/marketplace/filters';
import { Discord } from '~/metro/components';

import useStyles from './match-control.style';

type MatchControlProps = {
	value: FilterMatch;
	/** The labels of `any` and `none`, such as Include and Exclude. */
	labels: [string, string];
	/** Dims the control while its filter has nothing picked. */
	disabled?: boolean;
	onChange: (match: FilterMatch) => void;
};

const MATCHES: FilterMatch[] = ['any', 'none'];

/**
 * @description Discord's segmented control over a filter's two operators, keeping or dropping what it picks.
 */
function MatchControl({ value, labels, disabled = false, onChange }: MatchControlProps) {
	const styles = useStyles();
	const picked = MATCHES.indexOf(value);
	const items = useMemo(
		() => MATCHES.map((match, index) => ({ id: match, label: labels[index] })),
		[labels],
	);
	const state = Discord.useSegmentedControlState({
		items,
		pageWidth: Dimensions.get('window').width,
		defaultIndex: picked,
		onSetActiveIndex(index: number) {
			const next = MATCHES[index];

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
