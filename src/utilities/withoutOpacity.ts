import { processColor, type ColorValue } from 'react-native';

/**
 * @description Removes opacity from a color. Note: This will convert the color to a hex.
 * @param color The color to remove opacity from.
 * @returns The color provided as a hex string without opacity.
 */
function withoutOpacity(color: number | ColorValue): string {
	const processed = processColor(color).toString(16);

	return '#' + processed.slice(-6);
}

export default withoutOpacity;