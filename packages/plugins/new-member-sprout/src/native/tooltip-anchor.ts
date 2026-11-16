import type { NativeFabricFrame as Frame } from '@unbound-app/api/native';

import type { TouchPoint } from '~/native/tooltip';

const ANCHOR_SIZE = 20;

/**
 * @description The sprout's frame around the point that tapped it, since Discord reports no frame for a role icon tap.
 * @param point Where the tap landed, in window points.
 * @returns A sprout-sized frame centered on it.
 */
export function anchorAround({ x, y }: TouchPoint): Frame {
	return {
		x: x - ANCHOR_SIZE / 2,
		y: y - ANCHOR_SIZE / 2,
		width: ANCHOR_SIZE,
		height: ANCHOR_SIZE,
	};
}

export default { anchorAround };
