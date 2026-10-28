import type { StyleProp, ViewStyle } from 'react-native';

/** Options for Discord's custom colour picker sheet. Colours are 0xRRGGBB integers. */
export type ColorPickerOptions = {
	color: number;
	/** Swatches offered under the picker, as `#rrggbb`. */
	suggestedColors?: string[];
	/** Called with the picked colour on confirm, and with the current colour when the sheet is dismissed. */
	onSelect: (color: number) => void;
};

/** Discord's colour picker swatch: a rounded block, pressable only with `onSelect`. */
export type ColorBlockProps = {
	color: number;
	selected?: boolean;
	style?: StyleProp<ViewStyle>;
	onSelect?: (color: number) => void;
};
