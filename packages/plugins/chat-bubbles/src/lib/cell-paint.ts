import type { Box } from '~/lib/geometry';
import type { Heading } from '~/lib/message-layout';
import type { CellAvatar, CellFallback, CellPaint } from '~/native/ios/ui-cell';
import { headingPlace, type HeadingSpot } from '~/lib/heading';
import { shadeColor } from '~/lib/shade';
import {
	headingMoves,
	namesInside,
	rowInset,
	type BubbleAppearance,
	type BubbleColor,
	type HeadingMoves,
	type Padding,
} from '~/lib/style';
import { Quote } from '~/lib/constants';

/** What the measure found about a cell's heading. */
export type MeasuredHeading = HeadingSpot & {
	heading?: Heading;
	/** Where the message's text starts in the cell. */
	bodyTop: number;
	/** Whether the timestamp stays where Discord put it, as on a card. */
	keepTime: boolean;
	/** How far the name, reply and avatar lift into the room above the bubble when they sit outside it. */
	lifted: number;
	/** How the name, avatar and reply move while they sit outside the bubble. */
	moves: HeadingMoves;
};

/**
 * @description Works out everything a cell shows besides its bubble: where its name, time, avatar and reply move, its quote box and the avatar by its group's last bubble.
 * @param measured The cell's heading as measured.
 * @param bubble The fitted bubble's frame in the cell.
 * @param padding The room between the bubble's edges and the heading it holds.
 * @param color The bubble's color, which the quote box is shaded from.
 * @param picture Whose avatar the row shows and where it sits in the group, or `undefined` to leave it to Discord.
 * @returns The cell's paint.
 */
export function cellPaint(
	measured: MeasuredHeading,
	bubble: Box,
	padding: Padding,
	color: BubbleColor,
	picture: CellAvatar | undefined,
): CellPaint {
	const { heading, inside, quoted, keepTime, moves } = measured;
	const extra = picture ? { picture } : {};

	if (!inside || !heading) {
		return { ...moves, ...extra };
	}

	const place = headingPlace(
		heading,
		bubble,
		measured.bodyTop,
		padding.horizontal,
		padding.vertical,
		{ quoted, keepTime },
	);
	const reply = place.reply;
	const quote = reply?.quote;

	return {
		name: place.name,
		avatar: place.avatar,
		reply: reply?.move ?? { x: 0, y: 0 },
		...(place.time ? { time: place.time } : {}),
		...(quote
			? {
					quote: {
						box: { ...quote.box, x: quote.box.x - bubble.x, y: quote.box.y - bubble.y },
						clip: quote.clip,
						color: { ...shadeColor(color, Quote.shade), alpha: color.alpha },
						radius: Quote.radius,
					},
				}
			: {}),
		...extra,
	};
}

/**
 * @description Works out how a first row whose message was never measured is laid out until it is.
 * @param appearance The bubble's look.
 * @returns The moves of a first row without a reply, and whether its avatar hides.
 */
export function cellFallback(appearance: BubbleAppearance): CellFallback {
	const { avatarLast } = appearance;
	const none = { x: 0, y: 0 };

	if (namesInside(appearance)) {
		return {
			name: { x: rowInset(appearance), y: 0 },
			avatar: none,
			reply: none,
			hideStart: avatarLast,
		};
	}

	return { ...headingMoves(appearance), hideStart: avatarLast };
}

export default { cellFallback, cellPaint };
