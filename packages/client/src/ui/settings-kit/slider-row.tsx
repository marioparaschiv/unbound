import { useContext, useEffect, useState, type ReactElement } from 'react';
import { View } from 'react-native';

import { Discord, isRenderable } from '~/metro/components';

import useStyles from './slider-row.style';

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
 * @description Discord's `TableSliderRow`, as its own settings draw one: the label and live value over the slider
 * with its default mark. A sub-label, which that row cannot show, draws the same layout by hand with it under the label.
 * The value is saved when the drag ends; Android's slider and iOS's take differently named props, so it passes both.
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
	const styles = useStyles();
	const inGroup = useContext(Discord.TableRowGroupContext);
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
	const formatValue = (raw: number) => (format ? format(snap(raw)) : `${snap(raw)}${unit}`);

	if (!subLabel && isRenderable(Discord.TableSliderRow)) {
		return (
			<Discord.TableSliderRow
				label={label}
				value={value}
				defaultValue={defaultValue}
				minValue={minimum}
				maxValue={maximum}
				minimumValue={minimum}
				maximumValue={maximum}
				step={step}
				formatValue={formatValue}
				onChangeEnd={(next: number) => onChange(snap(next))}
				onSlidingComplete={(next: number) => onChange(snap(next))}
			/>
		);
	}

	// Inside a `TableRowGroup` the group rounds and divides its rows, so the card draws neither, as `TableSliderRow` does.
	return (
		<Discord.Card start={!inGroup} end={!inGroup} border='none' shadow='none'>
			<View style={styles.header}>
				<Discord.Text
					variant='body-md/semibold'
					color='mobile-text-heading-primary'
					style={styles.label}
				>
					{label}
				</Discord.Text>
				<Discord.Text variant='body-md/medium' color='text-muted'>
					{formatValue(dragged)}
				</Discord.Text>
			</View>
			{subLabel ? (
				<Discord.Text variant='text-sm/medium' color='text-muted'>
					{subLabel}
				</Discord.Text>
			) : null}
			<View style={styles.slider}>
				<Discord.Slider
					value={dragged}
					minValue={minimum}
					maxValue={maximum}
					minimumValue={minimum}
					maximumValue={maximum}
					step={step}
					defaultValue={defaultValue}
					accessibilityLabel={label}
					onChange={(next: number) => setDragged(snap(next))}
					onValueChange={(next: number) => setDragged(snap(next))}
					onChangeEnd={(next: number) => onChange(snap(next))}
					onSlidingComplete={(next: number) => onChange(snap(next))}
				/>
			</View>
		</Discord.Card>
	);
}

export default SliderRow;
