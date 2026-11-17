import type { Crop } from './frame-reader';

export type Rect = { x: number; y: number; width: number; height: number };

/**
 * @description Picks the part of a video frame to keep: all of it, or a centred square.
 * @param width The frame's width.
 * @param height The frame's height.
 * @param crop The crop.
 * @returns The rectangle to keep.
 */
export function cropRect(width: number, height: number, crop: Crop): Rect {
	if (crop === 'original') return { x: 0, y: 0, width, height };

	const side = Math.min(width, height);

	return {
		x: Math.floor((width - side) / 2),
		y: Math.floor((height - side) / 2),
		width: side,
		height: side,
	};
}

/**
 * @description Sizes the GIF: the chosen width, never wider than the crop, and an even height that keeps its shape.
 * @param rect The kept part of the frame.
 * @param width The chosen width.
 * @returns The GIF's width and height.
 */
export function outputSize(rect: Rect, width: number): { width: number; height: number } {
	const outWidth = Math.min(width, Math.floor(rect.width / 2) * 2);
	const outHeight = Math.max(2, Math.round((rect.height * outWidth) / rect.width / 2) * 2);

	return { width: outWidth, height: outHeight };
}

export default { cropRect, outputSize };
