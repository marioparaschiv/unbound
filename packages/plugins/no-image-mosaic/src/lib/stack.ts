export type TileSize = { width: number; height: number };
export type TileFrame = TileSize & { top: number };

/**
 * @description Sizes one tile as Discord sizes a lone image: the full width, or narrower when that would pass the
 * height limit.
 * @param aspect The image's width over its height.
 * @param width The width the mosaic lays out in.
 * @param maxHeight Discord's tallest image.
 * @returns The tile's width and height in whole pixels.
 */
export function singleSize(aspect: number, width: number, maxHeight: number): TileSize {
	'worklet';
	const ratio = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
	const height = Math.trunc(width / ratio);

	return height > maxHeight
		? { width: Math.trunc(maxHeight * ratio), height: maxHeight }
		: { width, height };
}

/**
 * @description Stacks tiles one per row, each sized as a lone image, with Discord's spacing between rows.
 * @param aspects Each tile's width over its height, in order.
 * @param width The width the mosaic lays out in.
 * @param maxHeight Discord's tallest image.
 * @param spacing The gap between rows.
 * @returns Each tile's frame, in order.
 */
export function stackTiles(
	aspects: number[],
	width: number,
	maxHeight: number,
	spacing: number,
): TileFrame[] {
	'worklet';
	const frames: TileFrame[] = [];
	let top = 0;

	for (const aspect of aspects) {
		const size = singleSize(aspect, width, maxHeight);

		frames.push({ top, ...size });
		top += size.height + spacing;
	}

	return frames;
}
