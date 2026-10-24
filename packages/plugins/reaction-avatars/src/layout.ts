export type Frame = {
	height: number;
	width: number;
	x: number;
	y: number;
};

export type LayoutFrame = Frame & {
	index: number;
};

export type LayoutItem = LayoutFrame & {
	extraWidth?: number;
};

function average(values: number[]): number {
	return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

/**
 * @description Checks whether two frames are the same to within half a point.
 * @param current The frame a view has now, or `undefined` when it could not be read.
 * @param target The frame it should have.
 * @returns `true` when no update is needed.
 */
export function framesMatch(current: Frame | undefined, target: Frame): boolean {
	return Boolean(
		current &&
		Math.abs(current.x - target.x) < 0.5 &&
		Math.abs(current.y - target.y) < 0.5 &&
		Math.abs(current.width - target.width) < 0.5 &&
		Math.abs(current.height - target.height) < 0.5,
	);
}

/**
 * @description Lays reaction pills out again left to right, wrapping rows, after some of them grew wider.
 * @param items The pills' original frames and how much each grew.
 * @param containerWidth The width of the reaction list.
 * @returns The new frames in index order, keeping the original spacing between pills and rows.
 */
export function reflowReactionItems(items: LayoutItem[], containerWidth: number): LayoutFrame[] {
	if (items.length === 0 || containerWidth <= 0) return [];

	const ordered = [...items].sort((first, second) => first.index - second.index);
	const startX = Math.min(...ordered.map((item) => item.x));
	const startY = Math.min(...ordered.map((item) => item.y));
	const horizontalGap = average(
		ordered.flatMap((item, position) => {
			const next = ordered[position + 1];

			if (!next || Math.abs(next.y - item.y) >= 1) return [];

			return [Math.max(0, next.x - item.x - item.width)];
		}),
	);
	const rowTops = [...new Set(ordered.map((item) => item.y))].sort(
		(first, second) => first - second,
	);
	const verticalGap = average(
		rowTops.flatMap((top, index) => {
			const nextTop = rowTops[index + 1];

			if (nextTop === undefined) return [];

			const rowBottom = Math.max(
				...ordered.filter((item) => item.y === top).map((item) => item.y + item.height),
			);

			return [Math.max(0, nextTop - rowBottom)];
		}),
	);
	const frames: LayoutFrame[] = [];

	let x = startX;
	let y = startY;
	let rowHeight = 0;

	for (const item of ordered) {
		const width = item.width + Math.max(0, item.extraWidth ?? 0);

		if (x > startX && x + width > startX + containerWidth) {
			x = startX;
			y += rowHeight + verticalGap;
			rowHeight = 0;
		}

		frames.push({ height: item.height, index: item.index, width, x, y });
		x += width + horizontalGap;
		rowHeight = Math.max(rowHeight, item.height);
	}

	return frames;
}

/**
 * @description Recovers a reaction view's original width after native cell reuse left it widened.
 * @param layoutWidth The pill's width in the collection layout.
 * @param cellWidth The collection cell's current width.
 * @param viewWidth The reaction view's current width.
 * @returns The view's width without any avatar extra.
 */
export function reactionBaseViewWidth(
	layoutWidth: number,
	cellWidth: number,
	viewWidth: number,
): number {
	const inset = Math.max(0, cellWidth - viewWidth);

	return Math.max(0, Math.min(viewWidth, layoutWidth - inset));
}

/**
 * @description Places the avatar surface right after the reaction pill's content.
 * @param contentFrame The pill's original frame.
 * @param surfaceWidth The avatar stack's width.
 * @param inset How far the surface overlaps the pill's trailing edge.
 * @returns The surface's x position and width.
 */
export function reactionAvatarFrame(
	contentFrame: Pick<Frame, 'width' | 'x'>,
	surfaceWidth: number,
	inset: number = 0,
): Pick<Frame, 'width' | 'x'> {
	return {
		x: Math.max(0, contentFrame.x + contentFrame.width - inset),
		width: Math.max(0, surfaceWidth),
	};
}
