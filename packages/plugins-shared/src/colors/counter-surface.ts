function rgbChannels(color: string): number[] | undefined {
	const hex = color.match(/^#?([\da-f]{6})$/i)?.[1];

	if (hex) return [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));

	return color
		.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
		?.slice(1, 4)
		.map(Number);
}

/**
 * @description Picks a subtle pill background that contrasts with the theme's text color, for the pills drawn above
 * the chat input.
 * @param textColor The theme's text color, as hex or `rgb()`.
 * @returns A light tint behind light text or an unreadable color, a dark tint behind dark text.
 */
export function counterSurface(textColor: unknown): string {
	const channels = typeof textColor === 'string' ? rgbChannels(textColor) : undefined;
	const darkText =
		channels && (channels[0] * 299 + channels[1] * 587 + channels[2] * 114) / 1000 <= 160;

	return darkText ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.12)';
}

export default counterSurface;
