import { splitMatches, type ContentNode } from '@unbound-plugins/shared/metro/content-nodes';

import { COLOR_PATTERN, parseColor, toHex } from '~/lib/colors';

export type NativeColor = (hex: string) => number | undefined;

/**
 * @description Builds the pill Discord draws for a role mention, tinted with a color and showing the color as written.
 * @param text The color as written.
 * @param color The color.
 * @param nativeColor Converts `#rrggbb` to the native color value.
 * @returns The content node.
 */
export function colorPill(text: string, color: number, nativeColor: NativeColor): ContentNode {
	const hex = toHex(color);

	return {
		type: 'mention',
		roleId: '0',
		roleName: text,
		roleColor: nativeColor(hex),
		color,
		colorString: hex,
		content: [{ type: 'text', content: text }],
	};
}

/**
 * @description Turns the colors written in a text into tinted pills.
 * @param text A text node's text.
 * @param nativeColor Converts `#rrggbb` to the native color value.
 * @returns The nodes, or `undefined` when the text has no color.
 */
export function splitColors(text: string, nativeColor: NativeColor): ContentNode[] | undefined {
	return splitMatches(text, COLOR_PATTERN, (match) => {
		const color = parseColor(match[0]);

		return color === undefined ? undefined : [colorPill(match[0], color, nativeColor)];
	});
}

export default { colorPill, splitColors };
