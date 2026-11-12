import type { Box } from '~/lib/geometry';

/**
 * @description Places a group's avatar beside its last bubble: the avatar's column, its bottom level with the bubble's.
 * @param bubble The last bubble's frame in its cell.
 * @param avatar Where Discord lays the avatar out in the group's first row.
 * @returns The avatar's frame in the cell.
 */
export function lastAvatarFrame(bubble: Box, avatar: Box): Box {
	'worklet';

	return {
		x: avatar.x,
		y: bubble.y + bubble.height - avatar.height,
		width: avatar.width,
		height: avatar.height,
	};
}

export default { lastAvatarFrame };
