export type Box = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type Padding = {
	horizontal: number;
	vertical: number;
};

export type Edges = {
	left: number;
	top: number;
	right: number;
	bottom: number;
};

/**
 * @description Narrows a message body to its content and grows it by the bubble padding.
 * @param body The message body's frame.
 * @param contentWidth How far the body's text and media reach from its left edge, or 0 when unknown.
 * @param padding The room around the content, in the body's units.
 * @returns The bubble's frame.
 */
export function bubbleFrame(body: Box, contentWidth: number, padding: Padding): Box {
	const width = contentWidth > 0 && contentWidth < body.width ? contentWidth : body.width;
	const { horizontal, vertical } = padding;

	return {
		x: body.x - horizontal,
		y: body.y - vertical,
		width: width + horizontal * 2,
		height: body.height + vertical * 2,
	};
}

/**
 * @description Unions edge rectangles.
 * @param boxes The rectangles.
 * @returns Their bounding rectangle, or `undefined` when there are none.
 */
export function union(boxes: Edges[]): Edges | undefined {
	if (!boxes.length) return;

	return {
		left: Math.min(...boxes.map((box) => box.left)),
		top: Math.min(...boxes.map((box) => box.top)),
		right: Math.max(...boxes.map((box) => box.right)),
		bottom: Math.max(...boxes.map((box) => box.bottom)),
	};
}

/**
 * @description Turns a bubble's frame into the insets that place it inside a row's bounds.
 * @param bubble The bubble's frame in the row.
 * @param width The row's width.
 * @param height The row's height.
 * @returns The insets from each edge, never negative.
 */
export function rowInsets(bubble: Box, width: number, height: number): Edges {
	return {
		left: Math.max(0, Math.round(bubble.x)),
		top: Math.max(0, Math.round(bubble.y)),
		right: Math.max(0, Math.round(width - bubble.x - bubble.width)),
		bottom: Math.max(0, Math.round(height - bubble.y - bubble.height)),
	};
}

export default { bubbleFrame, rowInsets, union };
