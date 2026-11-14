import type { NativeViewSnapshotNode } from '@unbound-app/api/native';
import { MESSAGE_TEXT_VIEW_CLASSES } from '@unbound-plugins/shared/native/ios/text-attachments';

import {
	CONTENT_COLUMN_MINIMUM_WIDTH,
	CONTENT_COLUMN_SEARCH_DEPTH,
	CONTENT_COLUMN_WIDTH_RATIO,
	IOSClass,
	MEDIA_VIEW_CLASSES,
	ROUNDED_MEDIA_CLASSES,
} from '~/lib/constants';
import type { Box } from '~/lib/geometry';

export type SnapshotNode = Pick<
	NativeViewSnapshotNode,
	'parent' | 'className' | 'frame' | 'text' | 'visible'
> &
	Partial<Pick<NativeViewSnapshotNode, 'view'>>;

export type MessageLayout = {
	body: Box;
	column: Box;
	/** The author's avatar in the cell, where Discord lays it out even on rows that hide it. */
	avatar: Box;
	text?: { index: number; offset: number };
	mediaRight: number;
	/** How far down the cell the body's media starts and ends, when it has any. */
	media?: { top: number; bottom: number };
	/** The media views Discord rounds itself, and how far down the cell their top and bottom are. */
	roundedMedia?: { indices: number[]; top: number; bottom: number };
	headerBottom?: number;
	/** The views above the body in its column, such as the author's name and a reply preview, then the avatar's holder. */
	header?: number[];
	footerRight?: number;
	/** How far the body's own labels reach from its left edge, such as a forwarded message's "Forwarded" line. */
	labelRight?: number;
	/** The row-wide background Discord tints a message that mentions the user with, and the bar at its left edge. Discord keeps it hidden on other rows, so it may not show. */
	highlight?: { view: number; bar: number };
	/** The name row of a message that starts a group, and its reply preview. */
	heading?: Heading;
	/** How far down the cell the holder of the message's reactions starts, below its body, when it shows any. */
	reactionsTop?: number;
};

export type Heading = {
	/** The row holding the author's name, tags and timestamp. */
	name: Box;
	/** How far the name and its tags reach from the row's left edge. */
	nameWidth: number;
	/** How far below the name row's top the name's capitals start, where the platform can read it. */
	capitalTop?: number;
	time?: Box;
	/** The timestamp label's snapshot index, to measure the text it draws past its frame. */
	timeLabel?: number;
	/** The reply preview's holder, the view holding its avatar and text, its text label and where that label starts in the cell. */
	reply?: { container: Box; content: Box; label: number; labelX: number };
};

function hasSize(node: SnapshotNode): boolean {
	return node.frame.width > 0 && node.frame.height > 0;
}

function shows(node: SnapshotNode): boolean {
	return node.visible && hasSize(node);
}

function isMedia(node: SnapshotNode): boolean {
	return MEDIA_VIEW_CLASSES.includes(node.className) || node.className.includes('Sticker');
}

function isText(node: SnapshotNode): boolean {
	return MESSAGE_TEXT_VIEW_CLASSES.some((name) => name === node.className) && Boolean(node.text);
}

function childrenOf(nodes: SnapshotNode[], parent: number): number[] {
	return nodes.flatMap((node, index) => (node.parent === parent ? [index] : []));
}

function absolute(nodes: SnapshotNode[], index: number): Box {
	const { width, height } = nodes[index]!.frame;
	let x = 0;
	let y = 0;

	for (let current = index; current > 0; current = nodes[current]!.parent) {
		x += nodes[current]!.frame.x;
		y += nodes[current]!.frame.y;
	}

	return { x, y, width, height };
}

function hasContent(nodes: SnapshotNode[], index: number): boolean {
	const node = nodes[index]!;

	if (!shows(node) || node.className === IOSClass.reactions) return false;

	if (isMedia(node) || isText(node)) return true;

	return childrenOf(nodes, index).some((child) => hasContent(nodes, child));
}

// The author's avatar sits in the gutter, left of every avatar a message shows, such as an invite's server icon,
// which can be larger. Among avatars level with each other, the largest is the author's.
function authorAvatar(nodes: SnapshotNode[]): number | undefined {
	let best: { index: number; x: number; area: number } | undefined;

	nodes.forEach((node, index) => {
		const area = node.frame.width * node.frame.height;

		if (node.className !== IOSClass.avatar || area <= 0) return;

		const { x } = absolute(nodes, index);

		if (!best || x < best.x || (x === best.x && area > best.area)) best = { index, x, area };
	});

	return best?.index;
}

function contentColumn(nodes: SnapshotNode[], avatar: number): number | undefined {
	let node = avatar;

	for (let level = 0; level < CONTENT_COLUMN_SEARCH_DEPTH && nodes[node]!.parent >= 0; level++) {
		const parent = nodes[node]!.parent;
		const branch = nodes[node]!.frame.width;
		const column = childrenOf(nodes, parent).find((sibling) => {
			const width = nodes[sibling]!.frame.width;

			return (
				sibling !== node &&
				width > branch * CONTENT_COLUMN_WIDTH_RATIO &&
				width > CONTENT_COLUMN_MINIMUM_WIDTH
			);
		});

		if (column !== undefined) return column;

		node = parent;
	}
}

function descendants(nodes: SnapshotNode[], index: number, stop: (node: SnapshotNode) => boolean) {
	const found: number[] = [];
	const queue = childrenOf(nodes, index);

	while (queue.length) {
		const current = queue.shift()!;

		if (!shows(nodes[current]!) || nodes[current]!.className === IOSClass.reactions) continue;

		if (stop(nodes[current]!)) {
			found.push(current);
			continue;
		}

		queue.unshift(...childrenOf(nodes, current));
	}

	return found;
}

// The name row is the header view holding the timestamp, a label of its own beside the name's container.
function trimFittedMedia(nodes: SnapshotNode[], mediaViews: number[], frame: Box): Box {
	const bottom = frame.y + frame.height;
	const [lowest] = mediaViews
		.map((index) => ({ index, box: absolute(nodes, index) }))
		.sort((a, b) => b.box.y + b.box.height - (a.box.y + a.box.height));

	if (!lowest) return frame;

	const holder = nodes[lowest.index]!.parent;
	const holderBox = absolute(nodes, holder);
	const scale = lowest.box.width > holderBox.width + 0.5 ? holderBox.width / lowest.box.width : 1;
	const mediaBottom = lowest.box.y + lowest.box.height * scale;
	const slack = holderBox.y + holderBox.height - mediaBottom;
	const below = childrenOf(nodes, holder).some((child) => {
		if (child === lowest.index || !shows(nodes[child]!)) return false;

		const box = absolute(nodes, child);

		return box.y + box.height > mediaBottom + 1;
	});

	if (slack <= 1 || below || Math.abs(holderBox.y + holderBox.height - bottom) > 1) return frame;

	return { ...frame, height: frame.height - slack };
}

function headingOf(
	nodes: SnapshotNode[],
	headerViews: number[],
	replyViews: number[],
): Heading | undefined {
	const isLabel = (index: number) => nodes[index]!.className === IOSClass.label;
	const name = headerViews.find((view) => childrenOf(nodes, view).some(isLabel));

	if (name === undefined) return;

	const time = childrenOf(nodes, name).find((child) => isLabel(child) && hasSize(nodes[child]!));
	const parts = childrenOf(nodes, name).filter((child) => shows(nodes[child]!));
	const nameWidth = Math.max(
		0,
		...parts
			.filter((part) => part !== time)
			.map((part) => nodes[part]!.frame.x + nodes[part]!.frame.width),
	);
	const [container] = replyViews;
	const [label] = container === undefined ? [] : descendants(nodes, container, isText);

	return {
		name: absolute(nodes, name),
		nameWidth,
		...(time === undefined ? {} : { time: absolute(nodes, time), timeLabel: time }),
		...(label === undefined
			? {}
			: {
					reply: {
						container: absolute(nodes, container!),
						content: absolute(nodes, nodes[label]!.parent),
						label,
						labelX: absolute(nodes, label).x,
					},
				}),
	};
}

function ephemeralFooterRight(nodes: SnapshotNode[], body: number, left: number) {
	const [footer] = descendants(nodes, body, (node) => node.className === IOSClass.ephemeral);
	const [button] =
		footer === undefined
			? []
			: descendants(nodes, footer, (node) => node.className === IOSClass.button);

	if (button === undefined) return;

	const box = absolute(nodes, button);

	return box.x + box.width - left;
}

// Discord lays the reactions in a holder of their own in the content column, below the body.
function reactionsTop(nodes: SnapshotNode[], column: number): number | undefined {
	const reactions = nodes.findIndex(
		(node) => node.className === IOSClass.reactions && shows(node),
	);
	let holder = reactions;

	while (holder > 0 && nodes[holder]!.parent !== column) holder = nodes[holder]!.parent;

	return holder > 0 ? absolute(nodes, holder).y : undefined;
}

// Discord tints a mentioning message with a row-wide view whose only marker is a thin bar down its left edge.
// Visibility is left to the caller: the plugin fades the tint itself, which the snapshot reports as not shown.
function mentionHighlight(nodes: SnapshotNode[]): MessageLayout['highlight'] {
	const content = childrenOf(nodes, 0).find(
		(child) => nodes[child]!.className === IOSClass.contentView,
	);

	for (const view of content === undefined ? [] : childrenOf(nodes, content)) {
		if (nodes[view]!.frame.height <= 0) continue;

		const bar = childrenOf(nodes, view).find((child) => {
			const { x, width, height } = nodes[child]!.frame;

			return x === 0 && width > 0 && width <= 3 && height >= nodes[view]!.frame.height - 1;
		});

		if (bar !== undefined) return { view, bar };
	}
}

/**
 * @description Finds a message cell's body, the view its bubble wraps, from a snapshot of the cell.
 * @param nodes The cell's snapshot, the cell first, each frame in its parent's coordinates.
 * @returns The body's and the whole content column's frames in the cell, the body's first text view and how far its media reaches, or `undefined` for rows without an author column.
 */
export function messageLayout(nodes: SnapshotNode[]): MessageLayout | undefined {
	const avatar = authorAvatar(nodes);
	const column = avatar === undefined ? undefined : contentColumn(nodes, avatar);

	if (column === undefined) return;

	const body = childrenOf(nodes, column)
		.reverse()
		.find((child) => hasContent(nodes, child));

	if (body === undefined) return;

	const columnFrame = absolute(nodes, column);
	const columnLeft = columnFrame.x;
	const laidOut = absolute(nodes, body);
	const frame =
		laidOut.x > columnLeft
			? { ...laidOut, x: columnLeft, width: laidOut.width + laidOut.x - columnLeft }
			: laidOut;
	const row = nodes[column]!.parent;
	const rowTop = absolute(nodes, row).y;
	// A reply preview sits above the whole row, beside neither the avatar nor the column.
	const replyViews = childrenOf(nodes, nodes[row]!.parent).filter((child) => {
		const box = absolute(nodes, child);

		return child !== row && shows(nodes[child]!) && box.y + box.height <= rowTop + 1;
	});
	const headerViews = childrenOf(nodes, column).filter((child) => {
		const box = absolute(nodes, child);

		return child !== body && shows(nodes[child]!) && box.y + box.height <= frame.y + 1;
	});
	const highlight = mentionHighlight(nodes);
	const reactions = reactionsTop(nodes, column);
	const heading = headingOf(nodes, headerViews, replyViews);
	const above = headerViews.map((child) => absolute(nodes, child));
	const headerBottom = above.length
		? Math.max(...above.map((box) => box.y + box.height))
		: undefined;
	const [text] = descendants(
		nodes,
		body,
		(node) => isText(node) || node.className === IOSClass.ephemeral,
	).filter((index) => isText(nodes[index]!));
	const footerRight = ephemeralFooterRight(nodes, body, frame.x);
	// Discord sizes its labels to their text, so their frames give their width; labels inside media are the media's.
	const labels = descendants(
		nodes,
		body,
		(node) => isMedia(node) || node.className === IOSClass.label,
	).filter((index) => nodes[index]!.className === IOSClass.label && nodes[index]!.text);
	const labelRight = labels.length
		? Math.max(
				...labels.map((index) => {
					const box = absolute(nodes, index);

					return box.x + box.width - frame.x;
				}),
			)
		: undefined;
	// A mosaic spans the whole column, so its tiles, not the mosaic, say how far the media reaches.
	const mediaViews = descendants(nodes, body, isMedia).flatMap((media) => {
		if (nodes[media]!.className !== IOSClass.mosaic) return [media];

		const tiles = descendants(nodes, media, (node) =>
			ROUNDED_MEDIA_CLASSES.includes(node.className),
		);

		return tiles.length ? tiles : [media];
	});
	const mediaBoxes = mediaViews.map((media) => absolute(nodes, media));
	const trimmed = trimFittedMedia(nodes, mediaViews, frame);
	const mediaRight = Math.max(0, ...mediaBoxes.map((box) => box.x + box.width - frame.x));

	const rounded = descendants(nodes, body, (node) =>
		ROUNDED_MEDIA_CLASSES.includes(node.className),
	);
	const roundedBoxes = rounded.map((index) => absolute(nodes, index));

	return {
		body: trimmed,
		column: columnFrame,
		avatar: absolute(nodes, avatar!),
		...(mediaBoxes.length
			? {
					media: {
						top: Math.min(...mediaBoxes.map((box) => box.y)),
						bottom: Math.max(...mediaBoxes.map((box) => box.y + box.height)),
					},
				}
			: {}),
		...(rounded.length
			? {
					roundedMedia: {
						indices: rounded,
						top: Math.min(...roundedBoxes.map((box) => box.y)),
						bottom: Math.max(...roundedBoxes.map((box) => box.y + box.height)),
					},
				}
			: {}),
		text:
			text === undefined
				? undefined
				: { index: text, offset: absolute(nodes, text).x - frame.x },
		mediaRight,
		...(headerBottom === undefined
			? {}
			: {
					headerBottom,
					header: [...replyViews, ...headerViews, nodes[avatar!]!.parent],
				}),
		...(footerRight === undefined ? {} : { footerRight }),
		...(labelRight === undefined ? {} : { labelRight }),
		...(highlight ? { highlight } : {}),
		...(heading ? { heading } : {}),
		...(reactions === undefined ? {} : { reactionsTop: reactions }),
	};
}

export default { messageLayout };
