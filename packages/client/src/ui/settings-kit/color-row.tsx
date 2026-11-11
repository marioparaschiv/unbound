import type { ReactElement } from 'react';
import { View } from 'react-native';

import { Discord } from '~/metro/components';
import { findByName } from '~/metro/search';
import { ActionSheets } from '~/metro/api';
import { messages } from '~/i18n/api';

import useStyles from './color-row.style';

/** Props for `ColorRow`. */
export type ColorRowProps = {
	/** The row's title. */
	label: string;
	/** The chosen color as a `#RRGGBB` hex code, or `undefined` when the default applies. */
	color: string | undefined;
	/** The default color, swatched and opened in the picker while `color` is unset. */
	fallbackColor: string;
	/** The text shown under the label while `color` is unset, in place of the hex code. */
	fallbackLabel: string;
	/** Called with the new `#RRGGBB` hex code, or `undefined` when the user resets it. */
	onChange: (color: string | undefined) => void;
};

const SHEET_KEY = 'PluginColorPicker';

function toInteger(hex: string): number {
	return Number.parseInt(hex.replace('#', '').slice(0, 6), 16) || 0;
}

function toHex(color: number): string {
	return `#${(color & 0xffffff).toString(16).padStart(6, '0').toUpperCase()}`;
}

function openPicker(color: string, onSelect: (color: string) => void): boolean {
	const picker = findByName('CustomColorPickerActionSheet');

	if (!picker || !ActionSheets?.openLazy) {
		return false;
	}

	ActionSheets.openLazy(Promise.resolve({ default: picker }), SHEET_KEY, {
		color: toInteger(color),
		onSelect: (selected: number) => {
			if (selected !== toInteger(color)) {
				onSelect(toHex(selected));
			}

			ActionSheets.hideActionSheet(SHEET_KEY);
		},
	});

	return true;
}

/**
 * @description A settings row that shows a color swatch, opens Discord's color picker when pressed and offers a reset back to the default. Discord's picker reports its current color when dismissed, so a pick matching the shown color is ignored.
 * @param props The row's label, chosen color, the default it falls back to and the change handler.
 * @returns The row.
 */
function ColorRow({
	label,
	color,
	fallbackColor,
	fallbackLabel,
	onChange,
}: ColorRowProps): ReactElement {
	const styles = useStyles();
	const shown = color ?? fallbackColor;

	return (
		<Discord.TableRow
			label={label}
			subLabel={color ?? fallbackLabel}
			onPress={() => openPicker(shown, onChange)}
			trailing={
				<Discord.Stack
					direction='horizontal'
					spacing={16}
					align='center'
					style={styles.trailing}
				>
					<View
						style={color ? null : styles.hidden}
						pointerEvents={color ? 'auto' : 'none'}
						accessibilityElementsHidden={!color}
						importantForAccessibility={color ? 'auto' : 'no-hide-descendants'}
					>
						<Discord.Button
							size='sm'
							variant='secondary'
							text={messages.UNBOUND_RESET}
							onPress={() => onChange(undefined)}
						/>
					</View>
					<View style={[styles.swatch, { backgroundColor: shown }]} />
				</Discord.Stack>
			}
		/>
	);
}

export default ColorRow;
