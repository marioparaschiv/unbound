import { describe, expect, test } from 'bun:test';

import { messageLayout, type SnapshotNode } from '~/bubbles/message-layout';

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
			column: { x: 68, y: 16, width: 291, height: 72 },
			avatar: { x: 16, y: 16, width: 40, height: 40 },
			text: { index: 12, offset: 0 },
			mediaRight: 180,
			media: { top: 64, bottom: 89 },
			headerBottom: 38,
			header: [6, 3],
			heading: {
				name: { x: 68, y: 16, width: 291, height: 22 },
				nameWidth: 0,
				time: { x: 283, y: 20, width: 76, height: 17 },
			},
		});
	});

	test("finds the author's avatar in the gutter, not a larger one inside the message, like an invite's server icon", () => {
		const invite = [...cell, node(13, 'DCDAvatarView', [16, 0, 50, 50])];

		expect(messageLayout(invite)?.body).toEqual({ x: 68, y: 38, width: 291, height: 50 });
	});

	test("reaches an invite card's right edge, not just the link text above it", () => {
		const invite = cell.map((entry, index) =>
			index === 13 ? node(11, 'DiscordChat.GuildInviteEmbedView', [0, 4, 260, 25]) : entry,
		);

		expect(messageLayout(invite)?.mediaRight).toBe(260);
	});

	test('lifts a reply preview above the row with the header', () => {
		const reply = [
			...cell,
			node(1, 'UIView', [0, 0, 375, 16]),
			node(14, 'UIView', [16, 0, 291, 16]),
		];

		expect(messageLayout(reply)?.header).toEqual([14, 6, 3]);
	});

	test('finds the name row, its time and a reply preview with its text', () => {
		const reply = [
			...cell,
			node(1, 'UIView', [0, 0, 375, 16]),
			node(14, 'DiscordChat.InlineReplyView', [0, 0, 375, 16]),
			node(15, 'DCDSpine', [0, 0, 52, 16]),
			node(15, 'UIView', [52, 0, 300, 14]),
			node(17, 'DCDReusableYYLabel', [20, 0, 100, 14], '@low yo'),
			node(6, 'UIView', [0, 0, 50, 22]),
		];

		expect(messageLayout(reply)?.heading).toEqual({
			name: { x: 68, y: 16, width: 291, height: 22 },
			nameWidth: 50,
			time: { x: 283, y: 20, width: 76, height: 17 },
			reply: {
				container: { x: 0, y: 0, width: 375, height: 16 },
				content: { x: 52, y: 0, width: 300, height: 14 },
				label: 18,
				labelX: 72,
			},
		});
	});

	test("finds Discord's mention tint by the bar at its left edge, shown or not", () => {
		const tint = node(1, 'UIView', [0, 0, 375, 90], null, false);
		const mention = [...cell, tint, node(14, 'UIView', [0, 0, 2, 90])];
		const wideBar = [...cell, tint, node(14, 'UIView', [0, 0, 20, 90])];

		expect(messageLayout(mention)?.highlight).toEqual({ view: 14, bar: 15 });
		expect(messageLayout(mention)?.header).toEqual([6, 3]);
		expect(messageLayout(wideBar)?.highlight).toBeUndefined();
		expect(messageLayout(cell)?.highlight).toBeUndefined();
	});

	test('reaches back to the content column for an indented body, like a forwarded message', () => {
		const forwarded = cell.map((entry, index) =>
			index === 7 ? node(4, 'UIView', [20, 22, 271, 50]) : entry,
		);

		expect(messageLayout(forwarded)?.body).toEqual({ x: 68, y: 38, width: 291, height: 50 });
	});

	test("reaches the body's own labels, like a forwarded message's header, but not its media's", () => {
		const forwarded = [
			...cell,
			node(10, 'DCDLabel', [16, 0, 120, 16], 'Forwarded'),
			node(13, 'DCDLabel', [0, 0, 250, 16], 'file.txt'),
		];

		expect(messageLayout(forwarded)?.labelRight).toBe(136);
		expect(messageLayout(cell)?.labelRight).toBeUndefined();
	});

	test('reads the text of builds that draw message text with YYText labels', () => {
		const yytext = cell.map((entry, index) =>
			index === 12 ? node(10, 'DCDReusableYYLabel', [0, 0, 291, 22], 'lol') : entry,
		);
		const textOnly = yytext.filter((_, index) => index !== 13);

		expect(messageLayout(yytext)?.text).toEqual({ index: 12, offset: 0 });
		expect(messageLayout(textOnly)?.body).toEqual({ x: 68, y: 38, width: 291, height: 50 });
	});

	test('skips an empty last child and hidden content', () => {
		const hidden = cell.map((entry, index) =>
			index === 13 ? { ...entry, visible: false } : entry,
		);

		expect(messageLayout(hidden)?.mediaRight).toBe(0);
	});

	test('gives the whole content column, header and reactions included, for the card layout', () => {
		const reacted = [
			...cell,
			node(4, 'UIView', [0, 72, 291, 30]),
			node(14, 'DCDReactionListView', [0, 0, 120, 30]),
		].map((entry, index) => (index === 4 ? node(2, 'UIView', [68, 0, 291, 102]) : entry));

		expect(messageLayout(reacted)?.column).toEqual({ x: 68, y: 16, width: 291, height: 102 });
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

	test("gives the reactions holder's top, below which a bubble never stretches", () => {
		const reacted = [
			...cell,
			node(4, 'UIView', [0, 82, 291, 38]),
			node(14, 'DCDReactionListView', [0, 4, 120, 34]),
		];

		expect(messageLayout(reacted)?.reactionsTop).toBe(98);
		expect(messageLayout(cell)?.reactionsTop).toBeUndefined();
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
