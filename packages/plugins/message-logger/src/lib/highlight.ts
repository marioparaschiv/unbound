import { processColor } from 'react-native';

import type { RowHighlight } from '~/lib/decorate';

const DEFAULT_BACKGROUND = '#f23f4326';
const DEFAULT_BAR = '#f23f43';

/**
 * @description Builds the highlight a deleted message gets from the colours the user picked, falling back to a red tint and bar.
 * @param background The highlight colour, `#RRGGBB` or `#RRGGBBAA`, or empty for the default.
 * @param bar The side bar's colour, or empty for the default.
 * @returns The highlight as Discord's ARGB colours, or `null` when a colour cannot be read.
 */
export function deletedHighlight(background: string, bar: string): RowHighlight | null {
	const backgroundColor = processColor(background || DEFAULT_BACKGROUND);
	const gutterColor = processColor(bar || DEFAULT_BAR);

	return typeof backgroundColor === 'number' && typeof gutterColor === 'number'
		? { backgroundColor, gutterColor }
		: null;
}

/**
 * @description Formats the label after an earlier version of an edited message.
 * @param custom What the user typed, or empty for Discord's own.
 * @param fallback Discord's ` (edited)`.
 * @returns The label, with a leading space.
 */
export function editedLabel(custom: string, fallback: string): string {
	const text = custom.trim();

	return text ? ` ${text}` : fallback;
}
