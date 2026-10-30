import { Discord } from '@unbound-app/api/metro/components';
import { View } from 'react-native';
import { useEffect, useState } from 'react';

type SliderRowProps = {
	label: string;
	value: number;
	defaultValue: number;
	minimum: number;
	maximum: number;
	step?: number;
	unit?: string;
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
}: SliderRowProps) {
	const [dragged, setDragged] = useState(value);

	useEffect(() => setDragged(value), [value]);

	if (!Discord.Slider) return null;

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
					{dragged !== defaultValue ? (
						<Discord.Button
							size='sm'
							variant='secondary'
							text='Reset'
							onPress={() => onChange(defaultValue)}
						/>
					) : null}
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
