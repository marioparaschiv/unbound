import type { LineOverflow } from '~/preferences';

export const CODE_LINE_HEIGHT = 14.5;

export type CodeBlockLayout = {
	/** Height of the code text. */
	contentHeight: number;
	/** Width of the code text; wider than the card when long lines scroll. */
	contentWidth: number;
	/** Height of the whole card, header included, capped at 520. */
	height: number;
};

/**
 * @description Estimates a code card's size before UIKit measures it, from monospace character metrics.
 * @param code The code.
 * @param width The card's width.
 * @param overflow Whether long lines wrap or scroll horizontally.
 * @returns The card height and the code text's size.
 */
export function codeBlockLayout(
	code: string,
	width: number,
	overflow: LineOverflow,
): CodeBlockLayout {
	const lines = code.split('\n');
	const longestLine = Math.max(...lines.map((line) => line.replaceAll('\t', '    ').length));
	const charactersPerLine = Math.max(12, Math.floor((width - 44) / 7.25));
	const lineCount =
		overflow === 'scroll'
			? lines.length
			: lines.reduce(
					(count, line) =>
						count + Math.max(1, Math.ceil((line.length + 4) / charactersPerLine)),
					0,
				);
	const contentHeight = Math.max(26, Math.ceil(2 + lineCount * CODE_LINE_HEIGHT));

	return {
		contentHeight,
		contentWidth: Math.max(width - 24, (longestLine + 4) * 9),
		height: Math.min(520, 50 + contentHeight),
	};
}

/**
 * @description Sizes a card's scroll content to the measured code, never shorter than its viewport.
 * @param measuredHeight The code label's measured height.
 * @param viewportHeight The scroll view's height.
 * @returns The content height.
 */
export function codeScrollHeight(measuredHeight: number, viewportHeight: number): number {
	return Math.max(viewportHeight, Math.ceil(measuredHeight) + 2);
}

/**
 * @description Tells whether a message row is shorter than the code card inside it, so the table must re-measure it.
 * @param cellHeight The row's height.
 * @param contentHeight The row content view's height.
 * @param labelBottom The bottom edge of the message label, in row coordinates.
 * @returns `true` when the content overflows the row by more than a point.
 */
export function shouldCorrectRow(
	cellHeight: number,
	contentHeight: number,
	labelBottom: number,
): boolean {
	return Math.max(contentHeight, labelBottom) > cellHeight + 1;
}

export default { CODE_LINE_HEIGHT, codeBlockLayout, codeScrollHeight, shouldCorrectRow };
