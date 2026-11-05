import type { ReactElement } from 'react';

import { Discord } from '~/metro/components';

import useStyles from './stepper-row.style';

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
	/** Dims the row and ignores input. Defaults to false. */
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
	const styles = useStyles();
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
				<Discord.Stack
					direction='horizontal'
					spacing={8}
					align='center'
					style={styles.trailing}
				>
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
				</Discord.Stack>
			}
		/>
	);
}

export default StepperRow;
