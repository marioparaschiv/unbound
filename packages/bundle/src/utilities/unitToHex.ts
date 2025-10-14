/**
 * @description Maps a number from 0 to 1 into a 2-character hex string.
 * @param number The number to parse into a hex string.
 * @returns The converted hex values.
 */
function unitToHex(number: number): string {
	const scaledNumber = Math.round(number * 255);
	const hexValue = scaledNumber.toString(16);

	return hexValue.length < 2 ? '0' + hexValue : hexValue;
}

export default unitToHex;