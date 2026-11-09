/** Which ends of a horizontal scroller hide content past its edge. */
export type ScrollEdges = { start: boolean; end: boolean };

/** Where a horizontal scroller is: its offset, its visible width and its content's width. */
export type ScrollMetrics = { offset: number; width: number; content: number };

// Sub-pixel slack, so rounding at either end never shows a fade over nothing.
const SLACK = 1;

/**
 * @description Finds which ends of a horizontal scroller hide content.
 * @param metrics The scroller's offset, width and content width.
 * @returns `start` once scrolled away from the start, `end` while content runs past the visible end.
 */
export function scrollEdges({ offset, width, content }: ScrollMetrics): ScrollEdges {
	return { start: offset > SLACK, end: offset + width < content - SLACK };
}

export default { scrollEdges };
