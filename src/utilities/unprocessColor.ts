/**
 * @description Turns a processed ReactNative colorValue into a plain hex color
 * @param {function} color - The color to unprocess.
 * @return {string}
 */
function unprocessColor(color: number): string {
	return '#' + color.toString(16).padStart(6, '0');
}

export default unprocessColor;