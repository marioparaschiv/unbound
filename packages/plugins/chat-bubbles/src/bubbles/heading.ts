import type { Box } from '~/bubbles/geometry';
import type { Heading } from '~/bubbles/message-layout';
import { NAME_TIME_GAP, Quote } from '~/constants';

/** How far a view's drawing moves, in points. */
export type Move = { x: number; y: number };

/** Where the heading sits in a first bubble before the bubble is fitted: the name's top, and the narrowest the bubble may be. */
export type HeadingRoom = { top: number; minWidth: number };

/** Where the name row, avatar, time and reply preview move once the bubble is fitted, and the reply's box. */
export type HeadingPlace = {
	name: Move;
	avatar: Move;
	/** The timestamp's frame in the name row. */
	time?: Box;
	reply?: {
		move: Move;
		/** The quote box in the cell. */
		box: Box;
		/** The box in the reply holder's own coordinates, to clip the preview to. */
		clip: Box;
	};
};

function nameTop({ name, reply }: Heading): number {
	return reply ? reply.container.y - Quote.room : name.y;
}

/**
 * @description Works out how much room the author's name, time and reply preview need inside a group's first bubble.
 * @param heading The name row and reply preview, where Discord laid them out.
 * @param replyTextWidth How wide the reply preview's text draws.
 * @param padding The bubble's horizontal padding.
 * @returns The name's top in the cell, and the narrowest bubble that fits the name, the time and the quote box.
 */
export function headingRoom(
	heading: Heading,
	replyTextWidth: number,
	padding: number,
): HeadingRoom {
	const { nameWidth, time, reply } = heading;
	const named = padding * 2 + nameWidth + (time ? NAME_TIME_GAP + time.width : 0);
	const quoted = reply
		? Quote.inset * 2 + Quote.padding * 2 + reply.labelX - reply.content.x + replyTextWidth
		: 0;

	return { top: nameTop(heading), minWidth: Math.max(named, quoted) };
}

/**
 * @description Places the author's name and time along the top of a group's fitted first bubble, and a reply's preview in a quote box between the name and the text.
 * @param heading The name row and reply preview, where Discord laid them out.
 * @param bubble The fitted bubble's frame in the cell.
 * @param bodyTop Where the message's text starts in the cell.
 * @param padding The bubble's horizontal padding.
 * @param capitalGap How far below the bubble's top the name's capitals sit, where the heading knows where they start.
 * @returns How far each view moves, the time's frame in the name row, and the quote box.
 */
export function headingPlace(
	heading: Heading,
	bubble: Box,
	bodyTop: number,
	padding: number,
	capitalGap = padding,
): HeadingPlace {
	const { name, time, reply, capitalTop } = heading;
	const top = nameTop(heading);
	const nameMove = {
		x: bubble.x + padding - name.x,
		y: capitalTop === undefined ? top - name.y : bubble.y + capitalGap - capitalTop - name.y,
	};
	const right = bubble.x + bubble.width - padding;
	const place: HeadingPlace = { name: nameMove, avatar: { x: 0, y: top - name.y } };

	if (time) {
		place.time = {
			x: right - time.width - name.x - nameMove.x,
			y: time.y - name.y,
			width: time.width,
			height: time.height,
		};
	}

	if (reply) {
		const boxTop = top + name.height + Quote.gap;
		const box = {
			x: bubble.x + Quote.inset,
			y: boxTop,
			width: bubble.width - Quote.inset * 2,
			height: Math.max(0, bodyTop - Quote.gap - boxTop),
		};
		const { content, container } = reply;
		const move = {
			x: box.x + Quote.padding - content.x,
			y: box.y + (box.height - content.height) / 2 - content.y,
		};

		place.reply = {
			move,
			box,
			clip: {
				x: box.x - container.x - move.x,
				y: box.y - container.y - move.y,
				// The preview's text runs on past the box; it stops the padding short of the box's right edge.
				width: box.width - Quote.padding,
				height: box.height,
			},
		};
	}

	return place;
}

export default { headingPlace, headingRoom };
