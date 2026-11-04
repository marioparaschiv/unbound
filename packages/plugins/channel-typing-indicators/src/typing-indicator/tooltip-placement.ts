export type TooltipAnchor = { x: number; y: number; width: number; height: number };
export type TooltipPlacement = {
	arrowDirection: 'UP' | 'DOWN';
	arrowOffset: number;
	left: number;
	top: number;
	width: number;
};

/**
 * @description Places the typing tooltip above its anchor, or below when there is no room, kept inside the window.
 * @param anchor The pressed indicator's frame in window coordinates.
 * @param labelLength The tooltip text's length, used to estimate its size.
 * @param viewportWidth The window width.
 * @returns The tooltip's position, width, and arrow.
 */
export function tooltipPlacement(
	anchor: TooltipAnchor,
	labelLength: number,
	viewportWidth: number,
): TooltipPlacement {
	const width = Math.min(viewportWidth - 16, Math.max(120, Math.min(260, labelLength * 6 + 28)));
	const center = anchor.x + anchor.width / 2;
	const left = Math.max(8, Math.min(center - width / 2, viewportWidth - width - 8));
	const height = Math.min(100, Math.max(42, Math.ceil(labelLength / 38) * 18 + 22));
	const below = anchor.y - height - 6 < 28;

	return {
		arrowDirection: below ? 'UP' : 'DOWN',
		arrowOffset: center - left - 8,
		left,
		top: below ? anchor.y + anchor.height + 6 : anchor.y - height - 6,
		width,
	};
}

export default { tooltipPlacement };
