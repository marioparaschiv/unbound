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
 * @description Says what is visibly wrong with a bubble: one that wraps nothing, reaches the screen's left edge or over the avatar column, or runs past its row.
 * @param bubble The bubble's frame in its row.
 * @param rowWidth The row's width.
 * @param contentWidth How wide the content the bubble wraps is.
 * @param leftLimit The furthest left the bubble may start, right of the avatar column, or `undefined` when unknown.
 * @returns The problem, or `undefined` for a bubble that fits its content.
 */
export function bubbleProblem(
	bubble: Box,
	rowWidth: number,
	contentWidth: number,
	leftLimit?: number,
): string | undefined {
	if (contentWidth <= 0 || bubble.width <= 0 || bubble.height <= 0) return 'wraps no content';
	if (bubble.x <= 0) return 'reaches the left edge of the screen';
	if (leftLimit !== undefined && bubble.x < leftLimit - 1)
		return 'reaches over the avatar column';
	if (rowWidth > 0 && bubble.x + bubble.width > rowWidth + 1) return 'runs past its row';
}

/**
 * @description Measures how far a drawn bubble is from where it should be, by its furthest edge.
 * @param drawn The bubble's frame on screen.
 * @param expected The frame its message needs now.
 * @returns The largest difference between matching edges, in points.
 */
export function frameDrift(drawn: Box, expected: Box): number {
	return Math.max(
		Math.abs(drawn.x - expected.x),
		Math.abs(drawn.y - expected.y),
		Math.abs(drawn.x + drawn.width - (expected.x + expected.width)),
		Math.abs(drawn.y + drawn.height - (expected.y + expected.height)),
	);
}

/**
 * @description Narrows a message body to its content and grows it by the bubble padding, without reaching above the message's header.
 * @param body The message body's frame.
 * @param contentWidth How far the body's text and media reach from its left edge, or 0 when unknown.
 * @param padding The room around the content, in the body's units.
 * @param ceiling Where the header above the body ends, such as the author's name and timestamp, or `undefined` when the message has none.
 * @returns The bubble's frame.
 */
export function bubbleFrame(
	body: Box,
	contentWidth: number,
	padding: Padding,
	ceiling?: number,
): Box {
	const width = contentWidth > 0 && contentWidth < body.width ? contentWidth : body.width;
	const { horizontal, vertical } = padding;
	const bottom = body.y + body.height + vertical;
	const top =
		ceiling === undefined
			? body.y - vertical
			: Math.max(body.y - vertical, Math.min(ceiling, body.y));

	return {
		x: body.x - horizontal,
		y: top,
		width: width + horizontal * 2,
		height: bottom - top,
	};
}

/**
 * @description Draws one card behind a message's whole content column, the way Rosiecord's Flowercord does: reaching past the column by the padding on every side.
 * @param column The content column's frame, right of the avatar.
 * @param padding How far the card reaches past the column's sides, and above and below it.
 * @returns The card's frame.
 */
export function cardFrame(
	column: Box,
	{ horizontal, vertical }: { horizontal: number; vertical: number },
): Box {
	return {
		x: column.x - horizontal,
		y: column.y - vertical,
		width: column.width + horizontal * 2,
		height: column.height + vertical * 2,
	};
}

/**
 * @description Finds where a row's content column ends: at the right edge of its width-filling children when it has any, which also teaches the gap left to the edge for that column width, otherwise at the width minus the gap learned earlier.
 * @param fillingRights The right edges of the children that fill the column's width.
 * @param width The column's width.
 * @param gutter The gap to the edge already learned for this width, if any.
 * @returns The column end, when it can be told, and the gap to remember for this width.
 */
export function columnEndFrom(
	fillingRights: number[],
	width: number,
	gutter: number | undefined,
): { end: number | undefined; gutter: number | undefined } {
	if (fillingRights.length) {
		const end = Math.max(...fillingRights);

		return { end, gutter: width - end };
	}

	return { end: gutter === undefined ? undefined : width - gutter, gutter };
}

/**
 * @description Whether a row's content left edge has been laid out: an unread or zero edge means the row has not been measured yet, since message content always sits right of the avatar gutter.
 * @param left The content's left edge, if it could be read.
 * @returns True when the position can be trusted.
 */
export function isLaidOut(left: number | undefined): left is number {
	return typeof left === 'number' && left > 0;
}

/**
 * @description Picks where a row's bubble starts from that row alone: its content column when it is laid out, so an indented body still lines up with the text above it, otherwise the content's own left edge.
 * @param contentLeft Where the row's content starts.
 * @param columnLeft Where the row's content column starts, right of the avatar, if it could be read.
 * @returns The left edge the bubble wraps from.
 */
export function rowContentStart(contentLeft: number, columnLeft: number | undefined): number {
	return isLaidOut(columnLeft) ? Math.min(contentLeft, columnLeft) : contentLeft;
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

export default {
	bubbleFrame,
	bubbleProblem,
	cardFrame,
	columnEndFrom,
	frameDrift,
	isLaidOut,
	rowContentStart,
	rowInsets,
	union,
};
