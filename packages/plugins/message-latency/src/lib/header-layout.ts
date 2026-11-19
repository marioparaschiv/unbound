import type { NativeFabricFrame as Frame } from '@unbound-app/api/native';

export type HeaderFrames = {
	row: Frame;
	container: Frame;
	name: Frame;
	label: Frame;
	tags?: Frame;
	timestamp?: Frame;
};

export type BadgedHeader = {
	icon: Frame;
	frames: HeaderFrames;
};

const TOLERANCE = 0.5;

function rightEdge(frame: Frame): number {
	'worklet';

	return frame.x + frame.width;
}

function moved(frame: Frame, dx: number, dw = 0): Frame {
	'worklet';

	return { ...frame, x: frame.x + dx, width: frame.width + dw };
}

/**
 * @description Lays the badge where the name starts and moves the name, its tags and a timestamp after them right by
 * the badge, taking any room the row lacks from the name, as Discord does.
 * @param frames The header's frames as Discord laid them out.
 * @param badge The badge's size.
 * @param natural How wide the name would draw uncut; a name already cut gives the badge its room wherever the row ends.
 * @returns The badge's frame in the container and the header's new frames.
 */
export function badgedHeader(
	frames: HeaderFrames,
	badge: { width: number; height: number },
	natural?: number,
): BadgedHeader {
	'worklet';
	const { row, container, name, label, tags, timestamp } = frames;
	const movesTimestamp = Boolean(timestamp && timestamp.x >= rightEdge(container) - TOLERANCE);
	const end = movesTimestamp ? rightEdge(timestamp!) : rightEdge(container);
	const overflow = Math.max(0, end + badge.width - row.width) - Math.max(0, end - row.width);
	const cut = Math.min(
		natural !== undefined && natural > label.width + TOLERANCE ? badge.width : overflow,
		name.width,
	);
	const dx = badge.width - cut;

	return {
		icon: {
			x: name.x,
			y: (container.height - badge.height) / 2,
			width: badge.width,
			height: badge.height,
		},
		frames: {
			row,
			container: moved(container, 0, dx),
			name: moved(name, badge.width, -cut),
			label: moved(label, 0, -cut),
			...(tags ? { tags: moved(tags, dx) } : {}),
			...(timestamp ? { timestamp: movesTimestamp ? moved(timestamp, dx) : timestamp } : {}),
		},
	};
}

export default { badgedHeader };
