import { useEffect, useMemo, type ReactElement } from 'react';
import { Dimensions, View } from 'react-native';

import type { ChoiceOption } from '~/ui/settings-kit/radio-row';
import { Discord } from '~/metro/components';

/** Props for `SegmentedRow`. */
export type SegmentedRowProps = {
	/** The row's label. */
	label: string;
	/** Text shown under the label; none when omitted. */
	subLabel?: string;
	/** The picked value. */
	value: string;
	/** Up to four options; their sub-labels are not drawn. */
	options: ChoiceOption[];
	disabled?: boolean;
	/** Called with the value of the segment the user presses. */
	onChange: (value: string) => void;
};

/**
 * @description A settings row with Discord's `SegmentedControl` under its label, as Discord's own settings draw one,
 * for two to four short options. A value changed elsewhere moves the control along with it.
 * @param props The row's label, picked value, options and change handler.
 * @returns The row.
 */
function SegmentedRow({
	label,
	subLabel,
	value,
	options,
	disabled = false,
	onChange,
}: SegmentedRowProps): ReactElement {
	const items = useMemo(
		() => options.map((option) => ({ id: option.value, label: option.label })),
		[options],
	);
	const picked = Math.max(
		0,
		options.findIndex((option) => option.value === value),
	);
	const state = Discord.useSegmentedControlState({
		items,
		pageWidth: Dimensions.get('window').width,
		defaultIndex: picked,
		onSetActiveIndex(index: number) {
			const next = options[index];

			if (next && next.value !== value) {
				onChange(next.value);
			}
		},
	});

	useEffect(() => {
		if (state.activeIndex !== picked) {
			state.setActiveIndex(picked);
		}
	}, [picked]);

	return (
		<Discord.TableRow
			label={label}
			subLabel={
				<View style={{ gap: 8 }}>
					{subLabel ? (
						<Discord.Text variant='text-sm/medium' color='text-muted'>
							{subLabel}
						</Discord.Text>
					) : null}
					<View
						pointerEvents={disabled ? 'none' : 'auto'}
						style={disabled ? { opacity: 0.5 } : null}
					>
						<Discord.SegmentedControl state={state} />
					</View>
				</View>
			}
		/>
	);
}

export default SegmentedRow;
