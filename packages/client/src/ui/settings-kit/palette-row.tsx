import { Pressable, View } from 'react-native';
import type { ReactElement } from 'react';

import { Discord } from '~/metro/components';

/** Props for `PaletteRow`. */
export type PaletteRowProps = {
	/** The row's label. */
	label: string;
	/** Text shown under the label; none when omitted. */
	subLabel?: string;
	/** The picked color, `#RRGGBB`. */
	value: string;
	/** The colors offered, `#RRGGBB`. */
	presets: string[];
	disabled?: boolean;
	/** Called with the color the user presses. */
	onChange: (color: string) => void;
};

/**
 * @description A settings row with a grid of color swatches, the picked one ringed, for a fixed set of colors.
 * @param props The row's label, picked color, colors and change handler.
 * @returns The row.
 */
function PaletteRow({
	label,
	subLabel,
	value,
	presets,
	disabled = false,
	onChange,
}: PaletteRowProps): ReactElement {
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
					<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
						{presets.map((color) => (
							<Pressable
								key={color}
								accessibilityRole='radio'
								accessibilityLabel={color}
								accessibilityState={{
									selected: color.toLowerCase() === value.toLowerCase(),
									disabled,
								}}
								disabled={disabled}
								onPress={() => onChange(color)}
								style={{
									width: 32,
									height: 32,
									borderRadius: 16,
									backgroundColor: color,
									borderWidth:
										color.toLowerCase() === value.toLowerCase() ? 3 : 1,
									borderColor: 'rgba(255, 255, 255, 0.6)',
								}}
							/>
						))}
					</View>
				</View>
			}
		/>
	);
}

export default PaletteRow;
