import type { NativeViewSnapshotNode } from '@unbound-app/api/native';

import {
	CONTENT_COLUMN_MINIMUM_WIDTH,
	CONTENT_COLUMN_SEARCH_DEPTH,
	CONTENT_COLUMN_WIDTH_RATIO,
	IOSClass,
	MEDIA_VIEW_CLASSES,
} from '~/constants';
import type { Box } from '~/geometry';

export type SnapshotNode = Pick<
	NativeViewSnapshotNode,
	'parent' | 'className' | 'frame' | 'text' | 'visible'
> &
	Partial<Pick<NativeViewSnapshotNode, 'view'>>;

export type MessageLayout = {
	body: Box;
	text?: { index: number; offset: number };
	mediaRight: number;
	headerBottom?: number;
};

function shows(node: SnapshotNode): boolean {
	return node.visible && node.frame.width > 0 && node.frame.height > 0;
}

function isMedia(node: SnapshotNode): boolean {
	return MEDIA_VIEW_CLASSES.includes(node.className) || node.className.includes('Sticker');
}

function isText(node: SnapshotNode): boolean {
	return node.className === IOSClass.attributedText && Boolean(node.text);
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

function largestAvatar(nodes: SnapshotNode[]): number | undefined {
	let best: number | undefined;
	let bestArea = 0;

	nodes.forEach((node, index) => {
		const area = node.frame.width * node.frame.height;

		if (node.className === IOSClass.avatar && area > bestArea) {
			best = index;
			bestArea = area;
		}
	});

	return best;
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

/**
 * @description Finds a message cell's body, the view its bubble wraps, from a snapshot of the cell.
 * @param nodes The cell's snapshot, the cell first, each frame in its parent's coordinates.
 * @returns The body's frame in the cell, its first text view and how far its media reaches, or `undefined` for rows without an author column.
 */
export function messageLayout(nodes: SnapshotNode[]): MessageLayout | undefined {
	const avatar = largestAvatar(nodes);
	const column = avatar === undefined ? undefined : contentColumn(nodes, avatar);

	if (column === undefined) return;

	const body = childrenOf(nodes, column)
		.reverse()
		.find((child) => hasContent(nodes, child));

	if (body === undefined) return;

	const frame = absolute(nodes, body);
	const above = childrenOf(nodes, column)
		.filter((child) => child !== body && shows(nodes[child]!))
		.map((child) => absolute(nodes, child))
		.filter((box) => box.y + box.height <= frame.y + 1);
	const headerBottom = above.length
		? Math.max(...above.map((box) => box.y + box.height))
		: undefined;
	const [text] = descendants(nodes, body, isText);
	const mediaRight = Math.max(
		0,
		...descendants(nodes, body, isMedia).map((media) => {
			const box = absolute(nodes, media);

			return box.x + box.width - frame.x;
		}),
	);

	return {
		body: frame,
		text:
			text === undefined
				? undefined
				: { index: text, offset: absolute(nodes, text).x - frame.x },
		mediaRight,
		...(headerBottom === undefined ? {} : { headerBottom }),
	};
}

export default { messageLayout };
