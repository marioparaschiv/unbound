export type Frame = { x: number; y: number; width: number; height: number };

export type HeaderRow = {
	row: Frame;
	container: Frame;
	name: Frame;
	label: Frame;
	tags?: Frame;
	timestamp: Frame;
};

export const MIN_NAME_WIDTH = 64;
export const MIN_TIMESTAMP_WIDTH = 40;

const TOLERANCE = 0.5;

function grown(frame: Frame, dx: number, dw: number): Frame {
	'worklet';

	return { ...frame, x: frame.x + dx, width: frame.width + dw };
}

/**
 * @description Gives a name Discord squeezed to make room for a long timestamp, such as one ending in platform
 * symbols, part of the timestamp's room back, so the timestamp's end is cut before the name.
 * @param header The header's frames as Discord laid them out.
 * @param natural How wide the name would draw uncut.
 * @returns The header's new frames, or `undefined` when the name has its room or the timestamp has none to give.
 */
export function roomForName(header: HeaderRow, natural: number): HeaderRow | undefined {
	'worklet';
	const { row, container, name, label, tags, timestamp } = header;
	const wanted = Math.min(natural, MIN_NAME_WIDTH);
	const crowded =
		timestamp.x >= container.x + container.width - TOLERANCE &&
		timestamp.x + timestamp.width >= row.width - TOLERANCE;

	if (!crowded || name.width >= wanted - TOLERANCE) return undefined;

	const take = Math.min(wanted - name.width, Math.max(0, timestamp.width - MIN_TIMESTAMP_WIDTH));

	if (take < TOLERANCE) return undefined;

	return {
		row,
		container: grown(container, 0, take),
		name: grown(name, 0, take),
		label: grown(label, 0, take),
		...(tags ? { tags: grown(tags, take, 0) } : {}),
		timestamp: grown(timestamp, take, -take),
	};
}

export default { roomForName };
