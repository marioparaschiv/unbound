import type { NativeFabricFrame as Frame, NativeFabricSize as Size } from '@unbound-app/api/native';

import { Tooltip } from '~/constants';

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
	return Math.max(120, Math.min(Tooltip.maxWidth, windowWidth - 32)) - 20;
}

/**
 * @description Places the tooltip bubble centered on the indicator, below it when it fits and above it otherwise, inside the window.
 * @param text The measured size of the tooltip text.
 * @param icon The indicator's frame in window coordinates.
 * @param bounds The window's bounds.
 * @returns The bubble's frame and arrow, or `null` when the text has no usable size.
 */
export function placeTooltip(text: Size, icon: Frame, bounds: Frame): TooltipPlacement | null {
	const textWidth = Math.min(tooltipTextWidth(bounds.width), text.width);

	if (!(textWidth > 0 && text.height > 0)) return null;

	const width = textWidth + 28;
	const height = text.height + 20 + Tooltip.arrowHeight;
	const x = Math.max(8, Math.min(icon.x + (icon.width - width) / 2, bounds.width - width - 8));
	const belowY = icon.y + icon.height + Tooltip.anchorGap;
	const below = belowY + height <= bounds.height - 8;
	const y = below ? belowY : Math.max(8, icon.y - height - Tooltip.anchorGap);

	return {
		frame: { x, y, width, height },
		below,
		arrowOffset: icon.x + icon.width / 2 - x - 8,
	};
}

export default { tooltipTextWidth, placeTooltip };
