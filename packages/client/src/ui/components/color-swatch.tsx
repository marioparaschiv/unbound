import type { ColorBlockProps } from '@unbound-app/types/color-picker';
import { Pressable, View } from 'react-native';

import { intToHex } from '~/lib/theme-draft';

import useStyles from './color-swatch.style';

/**
 * @description Unbound's stand-in for Discord's `ColorBlock`: a rounded block filled with a colour.
 * @param props The colour, whether it is selected, a style override and an optional press handler.
 * @returns The swatch.
 */
function ColorSwatch({ color, selected, style, onSelect }: ColorBlockProps) {
	const styles = useStyles();
	// The fill is the user's colour, not a theme colour.
	const fill = { backgroundColor: intToHex(color) };
	const composed = [styles.swatch, selected ? styles.selected : null, fill, style];

	if (!onSelect) {
		return <View style={composed} />;
	}

	return (
		<Pressable accessibilityRole='button' style={composed} onPress={() => onSelect(color)} />
	);
}

export default ColorSwatch;
