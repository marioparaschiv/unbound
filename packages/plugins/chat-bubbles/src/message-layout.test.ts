import { describe, expect, test } from 'bun:test';

import { messageLayout, type SnapshotNode } from './message-layout';

function node(
	parent: number,
	className: string,
	[x, y, width, height]: number[],
	text: string | null = null,
	visible = true,
): SnapshotNode {
	return {
		parent,
		className,
		frame: { x: x!, y: y!, width: width!, height: height! },
		text,
		visible,
	};
}

const cell: SnapshotNode[] = [
	node(-1, 'DCDMessageTableViewCell', [0, 619, 375, 90]),
	node(0, 'UITableViewCellContentView', [0, 0, 375, 90]),
	node(1, 'UIView', [0, 16, 375, 72]),
	node(2, 'UIView', [16, 0, 52, 72]),
	node(2, 'UIView', [68, 0, 291, 72]),
	node(3, 'DCDAvatarView', [0, 0, 40, 40]),
	node(4, 'UIView', [0, 0, 291, 22]),
	node(4, 'UIView', [0, 22, 291, 50]),
	node(4, 'UIView', [0, 72, 291, 0]),
	node(6, 'DCDLabel', [215, 4, 76, 17], '10/21/26, 18:15'),
	node(7, 'UIView', [0, 0, 291, 22]),
	node(7, 'UIView', [0, 22, 291, 29]),
	node(10, 'DCDAttributedTextView', [0, 0, 291, 22], 'lol'),
	node(11, 'DiscordChat.MediaMosaicView', [0, 4, 180, 25]),
];

describe('message layout', () => {
	test('finds the body beside the avatar column, its text and its media', () => {
		expect(messageLayout(cell)).toEqual({
			body: { x: 68, y: 38, width: 291, height: 50 },
			text: { index: 12, offset: 0 },
			mediaRight: 180,
			headerBottom: 38,
		});
	});

	test('reaches back to the content column for an indented body, like a forwarded message', () => {
		const forwarded = cell.map((entry, index) =>
			index === 7 ? node(4, 'UIView', [20, 22, 271, 50]) : entry,
		);

		expect(messageLayout(forwarded)?.body).toEqual({ x: 68, y: 38, width: 291, height: 50 });
	});

	test('skips an empty last child and hidden content', () => {
		const hidden = cell.map((entry, index) =>
			index === 13 ? { ...entry, visible: false } : entry,
		);

		expect(messageLayout(hidden)?.mediaRight).toBe(0);
	});

	test('wraps the message, not the reactions below it', () => {
		const reacted = [
			...cell,
			node(4, 'UIView', [0, 72, 291, 30]),
			node(14, 'DCDReactionListView', [0, 0, 120, 30]),
			node(15, 'DCDMediaView', [0, 0, 30, 30]),
		];

		expect(messageLayout(reacted)?.body).toEqual({ x: 68, y: 38, width: 291, height: 50 });
	});

	test('reaches the help button of an ephemeral footer, leaving its text out of the message text', () => {
		const ephemeral = [
			...cell.slice(0, 13),
			node(11, 'DiscordChat.EphemeralView', [0, 8, 291, 17]),
			node(13, 'UIImageView', [0, 0, 16, 16]),
			node(13, 'DCDAttributedTextView', [20, 0, 255, 17], 'Only you can see this'),
			node(13, 'UIButton', [275, 1, 16, 16]),
		];
		const layout = messageLayout(ephemeral);

		expect(layout?.text).toEqual({ index: 12, offset: 0 });
		expect(layout?.footerRight).toBe(291);
	});

	test('gives up on rows without an avatar column', () => {
		expect(
			messageLayout(cell.filter((entry) => entry.className !== 'DCDAvatarView')),
		).toBeUndefined();
		expect(messageLayout([cell[0]!])).toBeUndefined();
	});
});
