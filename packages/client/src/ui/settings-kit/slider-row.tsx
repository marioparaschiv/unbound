import { useEffect, useState, type ReactElement } from 'react';
import { View } from 'react-native';

import { Discord } from '~/metro/components';

/** Props for `SliderRow`. */
export type SliderRowProps = {
	/** The row's title, shown left of the current value. */
	label: string;
	/** Text shown above the slider; none when omitted. */
	subLabel?: string;
	/** The saved value; the slider follows it whenever it changes. */
	value: number;
	/** The default, which Discord's slider marks on its track; the section's reset row restores it. */
	defaultValue: number;
	/** The lowest value the slider reaches. */
	minimum: number;
	/** The highest value the slider reaches. */
	maximum: number;
	/** The increment values snap to; `1` when omitted. */
	step?: number;
	/** Text appended to the shown value, such as `px` or `%`; none when omitted. */
	unit?: string;
	/** Formats the shown value, such as a fraction as a percentage; replaces `unit` when given. */
	format?: (value: number) => string;
	/** Called with the snapped value when a drag ends, not during the drag. */
	onChange: (value: number) => void;
};

/**
 * @description A settings row with Discord's form slider, as its own settings draw one: the label, then the slider
 * with its value label and default mark. The value updates while dragging and is saved when the drag ends; Android's
 * slider and iOS's take differently named props, so it passes both.
 * @param props The row's label, value, default, range and change handler.
 * @returns The row, or `null` when Discord's slider is unavailable.
 */
function SliderRow({
	label,
	subLabel,
	value,
	defaultValue,
	minimum,
	maximum,
	step = 1,
	unit = '',
	format,
	onChange,
}: SliderRowProps): ReactElement | null {
	const [dragged, setDragged] = useState(value);

	useEffect(() => setDragged(value), [value]);

	if (!Discord.Slider) return null;

	// Rounding to the step's decimals drops float noise, so 0.15 never saves as 0.15000000000000002.
	const decimals = String(step).split('.')[1]?.length ?? 0;
	const snap = (raw: number) =>
		Math.max(
			minimum,
			Math.min(maximum, Number((Math.round(raw / step) * step).toFixed(decimals))),
		);

	return (
		<Discord.TableRow
			label={label}
			subLabel={
				<View>
					{subLabel ? (
						<Discord.Text variant='text-sm/medium' color='text-muted'>
							{subLabel}
						</Discord.Text>
					) : null}
					<Discord.Slider
						value={dragged}
						minValue={minimum}
						maxValue={maximum}
						minimumValue={minimum}
						maximumValue={maximum}
						step={step}
						valueLabel={format ? format(dragged) : `${dragged}${unit}`}
						defaultValue={defaultValue}
						accessibilityLabel={label}
						onChange={(next: number) => setDragged(snap(next))}
						onValueChange={(next: number) => setDragged(snap(next))}
						onChangeEnd={(next: number) => onChange(snap(next))}
						onSlidingComplete={(next: number) => onChange(snap(next))}
					/>
				</View>
			}
		/>
	);
}

export default SliderRow;
