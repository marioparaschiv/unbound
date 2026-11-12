import type { Box } from '~/bubbles/geometry';
import type { Heading } from '~/bubbles/message-layout';
import type { BubbleAppearance } from '~/bubbles/style';
import { namesInside, repliesQuoted } from '~/bubbles/style';
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
		/** The quote box in the cell, and the box in the reply holder's own coordinates to clip the preview to; none while the preview sits above the bubble. */
		quote?: { box: Box; clip: Box };
	};
};

/** Where a row's heading goes: inside its bubble or moved around it, and whether its reply sits in a quote box. */
export type HeadingSpot = { inside: boolean; quoted: boolean };

/** How the heading is placed inside a bubble. */
export type HeadingOptions = {
	/** Whether the reply's preview sits in a quote box, otherwise above the bubble. */
	quoted?: boolean;
	/** Whether the timestamp stays where Discord put it, as on a card. */
	keepTime?: boolean;
};

function nameTop({ name, reply }: Heading, quoted: boolean): number {
	return reply && quoted ? reply.container.y - Quote.room : name.y;
}

/**
 * @description Works out where a row's heading goes for the bubble's look.
 * @param appearance The bubble's look.
 * @param heading The row's name row and reply preview, `undefined` on rows that continue a group.
 * @returns Whether it sits inside the bubble and whether its reply is quoted there.
 */
export function headingSpot(
	appearance: BubbleAppearance,
	heading: Heading | undefined,
): HeadingSpot {
	const quoted = Boolean(heading?.reply) && repliesQuoted(appearance);

	return { inside: Boolean(heading) && (quoted || namesInside(appearance)), quoted };
}

/**
 * @description Works out how much room the author's name, time and reply preview need inside a group's first bubble.
 * @param heading The name row and reply preview, where Discord laid them out.
 * @param replyTextWidth How wide the reply preview's text draws.
 * @param padding The bubble's horizontal padding.
 * @param quoted Whether the reply's preview sits in a quote box.
 * @returns The name's top in the cell, and the narrowest bubble that fits the name, the time and the quote box.
 */
export function headingRoom(
	heading: Heading,
	replyTextWidth: number,
	padding: number,
	quoted = true,
): HeadingRoom {
	const { nameWidth, time, reply } = heading;
	const named = padding * 2 + nameWidth + (time ? NAME_TIME_GAP + time.width : 0);
	const boxed =
		reply && quoted
			? Quote.inset * 2 + Quote.padding * 2 + reply.labelX - reply.content.x + replyTextWidth
			: 0;

	return { top: nameTop(heading, quoted), minWidth: Math.max(named, boxed) };
}

/**
 * @description Places the author's name and time along the top of a group's first bubble, and a reply's preview in a quote box between the name and the text, or just above the bubble.
 * @param heading The name row and reply preview, where Discord laid them out.
 * @param bubble The bubble's frame in the cell.
 * @param bodyTop Where the message's text starts in the cell.
 * @param padding The bubble's horizontal padding.
 * @param capitalGap How far below the bubble's top the name's capitals sit, where the heading knows where they start.
 * @param options Whether the reply is quoted and whether the time stays put.
 * @returns How far each view moves, the time's frame in the name row, and the quote box.
 */
export function headingPlace(
	heading: Heading,
	bubble: Box,
	bodyTop: number,
	padding: number,
	capitalGap = padding,
	{ quoted = true, keepTime = false }: HeadingOptions = {},
): HeadingPlace {
	const { name, reply, capitalTop } = heading;
	const time = keepTime ? undefined : heading.time;
	const top = nameTop(heading, quoted);
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

	if (reply && !quoted) {
		// The preview sits a gap above the bubble's top.
		place.reply = {
			move: { x: 0, y: bubble.y - Quote.gap - (reply.content.y + reply.content.height) },
		};
	} else if (reply) {
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
			quote: {
				box,
				clip: {
					x: box.x - container.x - move.x,
					y: box.y - container.y - move.y,
					// The preview's text runs on past the box; it stops the padding short of the box's right edge.
					width: box.width - Quote.padding,
					height: box.height,
				},
			},
		};
	}

	return place;
}

/**
 * @description Stretches a card up over the room a quoted reply's row makes, so the name moves to its top and the quote box fits below it.
 * @param card The card's frame around the content column.
 * @param heading The row's name row and reply preview.
 * @param options Whether the reply is quoted, and the card's vertical padding.
 * @returns The card's frame.
 */
export function quotedCard(
	card: Box,
	heading: Heading | undefined,
	{ quoted, vertical }: { quoted: boolean; vertical: number },
): Box {
	if (!quoted || !heading) return card;

	const top = Math.min(card.y, nameTop(heading, true) - vertical);

	return { ...card, y: top, height: card.y + card.height - top };
}

export default { headingPlace, headingRoom, headingSpot, quotedCard };
