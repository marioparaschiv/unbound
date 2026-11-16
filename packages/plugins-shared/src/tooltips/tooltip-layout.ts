import type { NativeFabricFrame as Frame, NativeFabricSize as Size } from '@unbound-app/api/native';

export const TooltipStyle = {
	maxWidth: 250,
	arrowHeight: 8,
	anchorGap: 3,
	fontSize: 13,
	duration: 3000,
};

export type TooltipPlacement = {
	frame: Frame;
	below: boolean;
	arrowOffset: number;
};

/**
 * @description The widest the tooltip text may wrap to in a window of this width.
 * @param windowWidth The window's width in points.
 * @returns The maximum text width in points.
 */
export function tooltipTextWidth(windowWidth: number): number {
	return Math.max(120, Math.min(TooltipStyle.maxWidth, windowWidth - 32)) - 20;
}

/**
 * @description Places the tooltip bubble centered on its anchor, below it when it fits and above it otherwise, inside the window.
 * @param text The measured size of the tooltip text.
 * @param anchor The anchor's frame in window coordinates.
 * @param bounds The part of the window the bubble may use, such as inside the system bars.
 * @returns The bubble's frame and arrow, or `null` when the text has no usable size.
 */
export function placeTooltip(text: Size, anchor: Frame, bounds: Frame): TooltipPlacement | null {
	const textWidth = Math.min(tooltipTextWidth(bounds.width), text.width);

	if (!(textWidth > 0 && text.height > 0)) return null;

	const width = textWidth + 28;
	const height = text.height + 20 + TooltipStyle.arrowHeight;
	const left = bounds.x + 8;
	const right = bounds.x + bounds.width - width - 8;
	const x = Math.max(left, Math.min(anchor.x + (anchor.width - width) / 2, right));
	const belowY = anchor.y + anchor.height + TooltipStyle.anchorGap;
	const below = belowY + height <= bounds.y + bounds.height - 8;
	const y = below ? belowY : Math.max(bounds.y + 8, anchor.y - height - TooltipStyle.anchorGap);

	return {
		frame: { x, y, width, height },
		below,
		arrowOffset: anchor.x + anchor.width / 2 - x - 8,
	};
}

export default { tooltipTextWidth, placeTooltip };
