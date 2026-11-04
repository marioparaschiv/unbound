import type { ReactElement } from 'react';
import { View } from 'react-native';

import { Discord } from '~/metro/components';

/** Props for `StepperRow`. */
export type StepperRowProps = {
	/** The row's label. */
	label: string;
	/** Text shown under the label; none when omitted. */
	subLabel?: string;
	/** The saved number. */
	value: number;
	/** The lowest value; none when omitted. */
	minimum?: number;
	/** The highest value; none when omitted. */
	maximum?: number;
	/** How much each press adds or takes away; `1` when omitted. */
	step?: number;
	disabled?: boolean;
	/** Called with the new number on each press. */
	onChange: (value: number) => void;
};

/**
 * @description A settings row with minus and plus buttons around the current number, each press moving it one step within its range.
 * @param props The row's label, value, range, step and change handler.
 * @returns The row.
 */
function StepperRow({
	label,
	subLabel,
	value,
	minimum = -Infinity,
	maximum = Infinity,
	step = 1,
	disabled = false,
	onChange,
}: StepperRowProps): ReactElement {
	const decimals = String(step).split('.')[1]?.length ?? 0;
	const move = (direction: number) =>
		onChange(
			Math.min(
				maximum,
				Math.max(minimum, Number((value + direction * step).toFixed(decimals))),
			),
		);

	return (
		<Discord.TableRow
			label={label}
			subLabel={subLabel}
			disabled={disabled}
			trailing={
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
					<Discord.Button
						size='sm'
						variant='secondary'
						text='−'
						disabled={disabled || value <= minimum}
						onPress={() => move(-1)}
					/>
					<Discord.Text variant='text-md/semibold' color='mobile-text-heading-primary'>
						{String(value)}
					</Discord.Text>
					<Discord.Button
						size='sm'
						variant='secondary'
						text='+'
						disabled={disabled || value >= maximum}
						onPress={() => move(1)}
					/>
				</View>
			}
		/>
	);
}

export default StepperRow;
