import type { ReactElement } from 'react';
import { Pressable } from 'react-native';

import { Discord } from '~/metro/components';

import useStyles from './palette-row.style';

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
	/** Dims the row and ignores input. Defaults to false. */
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
	const styles = useStyles();

	return (
		<Discord.TableRow
			label={label}
			subLabel={
				<Discord.Stack spacing={8}>
					{subLabel ? (
						<Discord.Text variant='text-sm/medium' color='text-muted'>
							{subLabel}
						</Discord.Text>
					) : null}
					<Discord.Stack direction='horizontal' spacing={8} style={styles.swatches}>
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
								style={[
									styles.swatch,
									{ backgroundColor: color },
									color.toLowerCase() === value.toLowerCase()
										? styles.picked
										: null,
								]}
							/>
						))}
					</Discord.Stack>
				</Discord.Stack>
			}
		/>
	);
}

export default PaletteRow;
