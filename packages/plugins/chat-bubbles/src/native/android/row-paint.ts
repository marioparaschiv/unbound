import type { Heading } from '~/lib/message-layout';
import type { Fitted } from '~/native/android/neighbours';
import { bubbleFrame, cardFrame, type Box } from '~/lib/geometry';
import { bubbleTail, cornerShape, separateFrame, withoutTailCorner } from '~/lib/group';
import { bubblePath, cornerRadii } from '~/lib/bubble-path';
import {
	headingPlace,
	headingRoom,
	headingSpot,
	quotedCard,
	type HeadingSpot,
	type Move,
} from '~/lib/heading';
import { mentionPaint } from '~/lib/mention-paint';
import { shadeColor } from '~/lib/shade';
import {
	argb,
	cardPadding,
	headingMoves,
	headingPadding,
	type BubbleAppearance,
	type BubbleColor,
	type HeadingMoves,
} from '~/lib/style';
import { filletData, pathData } from '~/native/android/path-data';
import {
	BubbleLayout,
	CornerCurve,
	Grouping,
	MediaCorners,
	Quote,
	SQUARED_CORNER_RATIO,
} from '~/lib/constants';

/** The smallest radius rerounded media keeps, so a bubble radius at or under the padding never squares it off. */
const MINIMUM_MEDIA_RADIUS = 4;

/** A message row as measured, in points, its boxes in the row's coordinates. */
export type RowLayout = {
	width: number;
	height: number;
	/** Whether the row shows the author's name, so it starts its group. */
	start: boolean;
	/** Where the name row ends, on rows that show it. */
	headerBottom?: number;
	heading?: Heading;
	/** How wide the reply preview's text draws. */
	replyTextWidth: number;
	/** The content the bubble wraps: the text, media and embeds, not the reactions. */
	body: Box;
	/** How far right the content draws. */
	contentRight: number;
	/** The whole content column, for the card layout. */
	column: Box;
	/** The top and bottom of media the bubble keeps its padding around, and its corner radius. */
	media?: { top: number; bottom: number; radius: number };
};

/** A bubble fitted to its row, before its neighbours are known. */
export type RowFrame = HeadingSpot & {
	frame: Box;
	radius: number;
	/** The radius to round the row's media to, or `undefined` to keep Discord's. */
	mediaRadius?: number;
	lifted: number;
	/** How the name, avatar and reply move while they sit outside the bubble. */
	moves: HeadingMoves;
};

/** Where the avatar goes on a row of a group whose avatar sits by its last bubble. */
export type RowPicture = {
	start: boolean;
	end: boolean;
	author: string;
	/** The bubble's bottom, and where Discord lays the avatar out and how tall, in the row's pixels. */
	bottom: number;
	top: number;
	height: number;
	/** The author's avatar and decoration from Discord's stores, for when no bound row showed them. */
	url?: string;
	decoration?: string;
};

/** Everything a row shows besides Discord's own drawing, in pixels. */
export type RowPaint = {
	rowWidth: number;
	rowHeight: number;
	/** The bubble's fill as SVG path data in the row, and its ARGB color. */
	fill: string;
	color: number;
	outline?: { path: string; color: number; width: number };
	quote?: { box: Box; color: number; radius: number };
	/** How far the chat background behind the bubble blurs, in pixels. */
	blur?: number;
	name: Move;
	avatar: Move;
	reply: Move;
	/** How far the timestamp moves right. */
	time?: number;
	/** The reply preview's visible part, in its own coordinates. */
	clip?: Box;
	picture?: RowPicture;
	/** The radius to round the row's media to, or `undefined` to keep Discord's. */
	mediaRadius?: number;
};

const scaled = (move: Move, scale: number): Move => ({ x: move.x * scale, y: move.y * scale });
const scaledBox = (box: Box, scale: number): Box => ({
	x: box.x * scale,
	y: box.y * scale,
	width: box.width * scale,
	height: box.height * scale,
});

/**
 * @description Fits a row's bubble to its content, its heading and its media, before its neighbours are known; the Android counterpart of the iOS measure.
 * @param layout The row as measured.
 * @param style The bubble's look.
 * @returns The bubble's frame and radius in the row, and whether the heading sits inside it or lifts above it.
 */
export function rowFrame(layout: RowLayout, style: BubbleAppearance): RowFrame {
	const dynamic = style.layout === BubbleLayout.dynamic;
	const { inside, quoted } = headingSpot(style, layout.heading);
	const lifted = !inside && style.roomyRows && dynamic ? style.verticalPadding : 0;

	if (!dynamic) {
		return {
			frame: separateFrame(
				quotedCard(cardFrame(layout.column, cardPadding(style)), layout.heading, {
					quoted,
					vertical: cardPadding(style).vertical,
				}),
				layout.height,
				style.spacing,
			),
			radius: style.radius,
			inside,
			quoted,
			lifted,
			moves: headingMoves(style),
		};
	}

	const padding = style.horizontalPadding;
	const room =
		inside && layout.heading
			? headingRoom(layout.heading, layout.replyTextWidth, padding, quoted)
			: undefined;
	const contentWidth = Math.max(
		0,
		layout.contentRight - layout.body.x,
		room ? room.minWidth - padding * 2 : 0,
	);
	const wrapped = bubbleFrame(
		layout.body,
		contentWidth,
		{ horizontal: padding, vertical: style.verticalPadding },
		inside || layout.headerBottom === undefined ? undefined : layout.headerBottom - lifted,
	);
	const top = room ? room.top - style.verticalPadding : wrapped.y;
	const frame = { ...wrapped, y: top, height: wrapped.y + wrapped.height - top };
	const fitted = mediaFit(frame, layout.media, style);
	const hard = layout.media && { ...layout.media, padding };
	// A joined row has little room below, so the group's last bubble hangs its padding into the next group's first row.
	const floor = style.grouping === Grouping.joined ? Number.POSITIVE_INFINITY : layout.height;

	return {
		...fitted,
		frame: separateFrame(fitted.frame, floor, style.spacing, hard),
		inside,
		quoted,
		lifted,
		moves: headingMoves(style),
	};
}

function mediaFit(
	frame: Box,
	media: RowLayout['media'],
	{ mediaCorners, radius, horizontalPadding: inset }: BubbleAppearance,
): Pick<RowFrame, 'frame' | 'radius' | 'mediaRadius'> {
	const unchanged = { frame, radius };

	if (!media || mediaCorners === MediaCorners.none) return unchanged;

	const touchesTop = media.top - frame.y <= inset + 1;
	const touchesBottom = frame.y + frame.height - media.bottom <= inset + 1;

	if (!touchesTop && !touchesBottom) return unchanged;

	if (mediaCorners === MediaCorners.reround) {
		return { ...unchanged, mediaRadius: Math.max(MINIMUM_MEDIA_RADIUS, radius - inset) };
	}

	if (mediaCorners === MediaCorners.concentric) return { frame, radius: media.radius + inset };

	const top = touchesTop ? media.top : frame.y;
	const bottom = touchesBottom ? media.bottom : frame.y + frame.height;

	return { frame: { ...frame, y: top, height: bottom - top }, radius: media.radius };
}

export type PaintInput = {
	layout: RowLayout;
	measured: RowFrame;
	fitted: Fitted;
	place: { start: boolean; end: boolean };
	style: BubbleAppearance;
	/** The bubble's color: the user's own or everyone else's. */
	color: BubbleColor;
	/** Discord's highlight bar color when the message mentions the user. */
	mention?: BubbleColor;
	/** The author, when the avatar moves to the group's last bubble, and where Discord lays the avatar out, in pixels. */
	author?: string;
	avatarBox?: { top: number; height: number };
	/** How many pixels make one point. */
	scale: number;
};

/**
 * @description Works out how a measured row is painted: its bubble's outline with grouped corners, a tail and joining curves, its mention highlight, quote box, the moves of its name, time, avatar and reply, and where its group's avatar goes.
 * @param input The row, its fitted bubble, its place in its group and the look.
 * @returns The paint, in pixels.
 */
export function rowPaint(input: PaintInput): RowPaint {
	const { layout, measured, fitted, place, style, scale } = input;
	const { frame, corners, fillets } = fitted;
	const tail = bubbleTail(style.tail, place);
	const shape = cornerShape(
		measured.radius,
		frame.width,
		frame.height,
		style.cornerCurve === CornerCurve.continuous,
	);
	const rounded = withoutTailCorner(corners, tail);
	// Joined bubbles touch, so their joins stay square to meet as one shape.
	const squared = style.grouping === Grouping.joined ? 0 : shape.radius * SQUARED_CORNER_RATIO;
	const radii = cornerRadii(rounded, shape.radius, squared, tail);
	const tailSize = tail ? Math.min(style.tailSize, frame.height / 2) : 0;
	const pathTail = tail && { side: tail, size: tailSize };
	const steps = bubblePath(frame.width, frame.height, radii, shape.continuous, pathTail);
	const fill = [pathData(steps, frame, scale), filletData(frame, fillets, scale)]
		.filter(Boolean)
		.join(' ');
	const painted = input.mention
		? mentionPaint(input.color, input.mention, style.mention)
		: { color: input.color };
	const heading = headingPaint(input, frame);

	return {
		rowWidth: Math.round(layout.width * scale),
		rowHeight: Math.round(layout.height * scale),
		fill,
		color: argb(painted.color),
		...(style.blur ? { blur: style.blur * scale } : {}),
		...('border' in painted && painted.border.width > 0
			? {
					outline: outlinePaint(
						frame,
						radii,
						shape.continuous,
						pathTail,
						painted.border,
						scale,
					),
				}
			: {}),
		name: scaled(heading.name, scale),
		avatar: scaled(heading.avatar, scale),
		reply: scaled(heading.reply, scale),
		...(heading.time === undefined ? {} : { time: heading.time * scale }),
		...(heading.clip ? { clip: scaledBox(heading.clip, scale) } : {}),
		...(heading.quote
			? {
					quote: {
						...heading.quote,
						box: scaledBox(heading.quote.box, scale),
						radius: heading.quote.radius * scale,
					},
				}
			: {}),
		...(input.author && input.avatarBox && style.avatarLast
			? {
					picture: {
						start: place.start,
						end: place.end,
						author: input.author,
						bottom: (frame.y + frame.height) * scale,
						...input.avatarBox,
					},
				}
			: {}),
		...(measured.mediaRadius === undefined
			? {}
			: { mediaRadius: measured.mediaRadius * scale }),
	};
}

type HeadingPaint = Pick<RowPaint, 'name' | 'avatar' | 'reply' | 'time' | 'clip' | 'quote'>;

function headingPaint({ layout, measured, style, color }: PaintInput, frame: Box): HeadingPaint {
	const { heading } = layout;

	if (!measured.inside || !heading) return measured.moves;

	const padding = headingPadding(style);
	const place = headingPlace(
		heading,
		frame,
		layout.body.y,
		padding.horizontal,
		padding.vertical,
		{
			quoted: measured.quoted,
			keepTime: style.layout === BubbleLayout.card,
		},
	);
	const reply = place.reply;
	const quote = reply?.quote;

	return {
		name: place.name,
		avatar: place.avatar,
		reply: reply?.move ?? { x: 0, y: 0 },
		// The timestamp sits in the name row; it moves from where Discord put it to the bubble's right.
		...(place.time && heading.time
			? { time: place.time.x - (heading.time.x - heading.name.x) }
			: {}),
		...(quote
			? {
					clip: quote.clip,
					quote: {
						box: quote.box,
						color: argb({ ...shadeColor(color, Quote.shade), alpha: color.alpha }),
						radius: Quote.radius,
					},
				}
			: {}),
	};
}

// The outline runs half its width inside the bubble's edge, so the fill covers it and it stays inside the bubble.
function outlinePaint(
	frame: Box,
	radii: ReturnType<typeof cornerRadii>,
	continuous: boolean,
	tail: { side: 'top' | 'bottom'; size: number } | undefined,
	border: { color: BubbleColor; width: number },
	scale: number,
) {
	const half = border.width / 2;
	const inner = (radius: number) => Math.max(0, radius - half);
	const steps = bubblePath(
		Math.max(0, frame.width - border.width),
		Math.max(0, frame.height - border.width),
		{
			topLeft: inner(radii.topLeft),
			topRight: inner(radii.topRight),
			bottomRight: inner(radii.bottomRight),
			bottomLeft: inner(radii.bottomLeft),
		},
		continuous,
		tail && { ...tail, size: Math.max(0, tail.size - half) },
	);

	return {
		path: pathData(steps, { x: frame.x + half, y: frame.y + half }, scale),
		color: argb(border.color),
		width: border.width * scale,
	};
}

export default { rowFrame, rowPaint };
