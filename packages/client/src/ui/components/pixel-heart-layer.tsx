import { memo } from 'react';

import { SVG } from '~/metro/common';

import { HEART_COLUMNS, HEART_PIXELS, HEART_ROWS, HEART_SIDE_PIXELS } from './pixel-heart-pixels';

type PixelHeartLayerProps = {
	/** The layer's width in points; its height follows the pixel grid. */
	size: number;
	/** Draws the darker side-wall colours, for a slice of the heart's body, instead of the face. */
	side?: boolean;
};

/**
 * @description One flat slice of the pixel heart: its face, or a body slice in each pixel's side-wall
 * colour, so the edges show every pixel's colour like an extruded Minecraft item.
 */
function PixelHeartLayer({ size, side = false }: PixelHeartLayerProps) {
	const height = (size / HEART_COLUMNS) * HEART_ROWS;

	return (
		<SVG.Svg width={size} height={height} viewBox={`0 0 ${HEART_COLUMNS} ${HEART_ROWS}`}>
			{(side ? HEART_SIDE_PIXELS : HEART_PIXELS).map(({ x, y, color }) => (
				// The overlap hides the hairline seams antialiasing leaves between pixels.
				<SVG.Rect key={`${x},${y}`} x={x} y={y} width={1.02} height={1.02} fill={color} />
			))}
		</SVG.Svg>
	);
}

export default memo(PixelHeartLayer);
