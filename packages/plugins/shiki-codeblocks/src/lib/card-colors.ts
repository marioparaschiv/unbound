/**
 * @description Converts a theme's hex color to a CSS color with its opacity scaled, the way the iOS card applies `bgOpacity`.
 * @param hex `#RGB`, `#RRGGBB` or `#RRGGBBAA`.
 * @param opacity How much of the color's own alpha to keep, 0 to 1.
 * @returns An `rgba()` color, or `hex` unchanged when it cannot be parsed.
 */
export function cssColor(hex: string, opacity = 1): string {
	const value = hex.replace('#', '');
	const expanded = value.length === 3 ? [...value].map((digit) => digit + digit).join('') : value;

	if (!/^([\da-f]{6}|[\da-f]{8})$/i.test(expanded)) return hex;

	const [red, green, blue] = [0, 2, 4].map((index) =>
		Number.parseInt(expanded.slice(index, index + 2), 16),
	);
	const alpha = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1;
	const scaled = Math.round(alpha * Math.max(0, Math.min(1, opacity)) * 1000) / 1000;

	return `rgba(${red}, ${green}, ${blue}, ${scaled})`;
}

export default { cssColor };
