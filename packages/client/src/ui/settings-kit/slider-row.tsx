import { useEffect, useState, type ReactElement } from 'react';
import { View } from 'react-native';

import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';

/** Props for `SliderRow`. */
export type SliderRowProps = {
	/** The row's title, shown left of the current value. */
	label: string;
	/** The saved value; the slider follows it whenever it changes. */
	value: number;
	/** The value the reset button restores; the button shows only while the slider is elsewhere. */
	defaultValue: number;
	/** The lowest value the slider reaches. */
	minimum: number;
	/** The highest value the slider reaches. */
	maximum: number;
	/** The increment values snap to; `1` when omitted. */
	step?: number;
	/** Text appended to the shown value, such as `px` or `%`; none when omitted. */
	unit?: string;
	/** Called with the snapped value when a drag ends or the reset button is pressed, not during the drag. */
	onChange: (value: number) => void;
};

/**
 * @description A settings row with a slider, the current value and a reset button that appears once the value differs from its default. The value updates while dragging and is saved when the drag ends; Android's slider and iOS's take differently named props, so it passes both.
 * @param props The row's label, value, default, range and change handler.
 * @returns The row, or `null` when Discord's slider is unavailable.
 */
function SliderRow({
	label,
	value,
	defaultValue,
	minimum,
	maximum,
	step = 1,
	unit = '',
	onChange,
}: SliderRowProps): ReactElement | null {
	const [dragged, setDragged] = useState(value);

	useEffect(() => setDragged(value), [value]);

	if (!Discord.Slider) return null;

	const changed = dragged !== defaultValue;

	const snap = (raw: number) =>
		Math.max(minimum, Math.min(maximum, Math.round(raw / step) * step));

	return (
		<Discord.TableRow
			label={
				<View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
					<Discord.Text variant='text-md/semibold' color='mobile-text-heading-primary'>
						{label}
					</Discord.Text>
					<Discord.Text
						variant='text-sm/medium'
						color='text-muted'
						style={{ marginLeft: 'auto' }}
					>
						{`${dragged}${unit}`}
					</Discord.Text>
					<View
						style={{ opacity: changed ? 1 : 0 }}
						pointerEvents={changed ? 'auto' : 'none'}
						accessibilityElementsHidden={!changed}
						importantForAccessibility={changed ? 'auto' : 'no-hide-descendants'}
					>
						<Discord.Button
							size='sm'
							variant='secondary'
							text={messages.UNBOUND_RESET}
							onPress={() => onChange(defaultValue)}
						/>
					</View>
				</View>
			}
			subLabel={
				<Discord.Slider
					value={dragged}
					minValue={minimum}
					maxValue={maximum}
					minimumValue={minimum}
					maximumValue={maximum}
					step={step}
					onChange={(next: number) => setDragged(snap(next))}
					onValueChange={(next: number) => setDragged(snap(next))}
					onChangeEnd={(next: number) => onChange(snap(next))}
					onSlidingComplete={(next: number) => onChange(snap(next))}
				/>
			}
		/>
	);
}

export default SliderRow;
