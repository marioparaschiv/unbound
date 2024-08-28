import { processColor } from 'react-native';

/**
 * Returns the color provided as a hex string without opacity.
 * @param color The color to format
 * @returns string
 */
function withoutOpacity(color): string {
	return '#' + ('000000' + processColor(color).toString(16)).slice(-6);
}

export default withoutOpacity;