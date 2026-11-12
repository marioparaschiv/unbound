import {
	BLUR_RADIUS,
	BubbleBlur,
	BubbleLayout,
	BubbleLimits,
	BubbleStyle,
	CardPadding,
	CornerCurve,
	Grouping,
	JOINED_ROW_ROOM,
	MediaCorners,
	MENTION_WIDTH_STEP,
	Quote,
	ReplyStyle,
	TailPosition,
	type BubbleLayoutName,
} from '~/constants';

type ValueOf<T> = T[keyof T];

export type BubbleColor = {
	red: number;
	green: number;
	blue: number;
	alpha: number;
};

export type BubbleAppearance = {
	layout: BubbleLayoutName;
	radius: number;
	horizontalPadding: number;
	verticalPadding: number;
	spacing: number;
	mediaCorners: ValueOf<typeof MediaCorners>;
	cornerCurve: ValueOf<typeof CornerCurve>;
	grouping: ValueOf<typeof Grouping>;
	/** Whether a grouped bubble rounds a right corner that reaches past its neighbour's. */
	roundExposed: boolean;
	/** Whether a grouped bubble keeps every right corner round, squaring only the side by the avatar where bubbles meet. */
	roundOuter: boolean;
	/** The space between the bubbles of one group, 0 when they touch; joined groups always touch. */
	groupSpacing: number;
	/** Whether a joined bubble curves inward to meet a wider neighbour. */
	joinCurves: boolean;
	/** Whether a joined bubble widens to a neighbour that reaches past it by less than the corner radius. */
	smoothSteps: boolean;
	/** Whether message rows grow so each bubble keeps its full vertical padding and spacing. */
	roomyRows: boolean;
	/** Whether a group's avatar moves down beside its last bubble. */
	avatarLast: boolean;
	/** Whether the author's name and the time sit inside the group's first bubble. */
	nameInside: boolean;
	/** Where a reply's preview sits: in a quote box inside the bubble, or above it behind a reply icon. */
	reply: Exclude<ValueOf<typeof ReplyStyle>, 'auto'>;
	/** Which bubble of a group points a tail at the avatar: the last when the avatar moves down to it, otherwise the first. */
	tail: ValueOf<typeof TailPosition>;
	tailSize: number;
	color: BubbleColor;
	ownColor: BubbleColor;
	/** How far what lies behind a bubble blurs, in points; 0 for none, and while bubbles are opaque, which would hide it. */
	blur: number;
	/** The user's mention color, `undefined` for Discord's, the outline's opacity and width in points, and how far the fill tints, from 0 to 1. */
	mention: {
		color: Omit<BubbleColor, 'alpha'> | undefined;
		alpha: number;
		width: number;
		tint: number;
	};
};

export type SettingReader = (key: string) => unknown;

function bounded(value: unknown, fallback: number, maximum: number, step = 1): number {
	const number = typeof value === 'number' ? value : Number(value);

	if (value === null || value === undefined || value === '' || !Number.isFinite(number)) {
		return fallback;
	}

	return Math.max(0, Math.min(maximum, Math.round(number / step) * step));
}

/**
 * @description Reads a stored choice.
 * @template T The choice's options.
 * @param value The stored setting.
 * @param options The options it may hold, the first being the default.
 * @returns The stored option, or the first when it holds none of them.
 */
export function choice<T extends Record<string, string>>(value: unknown, options: T): ValueOf<T> {
	const values = Object.values(options) as ValueOf<T>[];

	return values.find((option) => option === value) ?? values[0]!;
}

function flag(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

/**
 * @description Reads where a reply's preview sits.
 * @param value The stored setting.
 * @param avatarLast Whether the avatar sits by a group's last bubble, which makes `icon` the default.
 * @returns `quote` or `icon`.
 */
export function replyStyle(
	value: unknown,
	avatarLast: boolean,
): Exclude<ValueOf<typeof ReplyStyle>, 'auto'> {
	const stored = choice(value, ReplyStyle);

	if (stored !== ReplyStyle.auto) return stored;

	return avatarLast ? ReplyStyle.icon : ReplyStyle.quote;
}

/**
 * @description Reads the stored bubble layout.
 * @param value The stored setting.
 * @returns `card` for one card per message, otherwise `dynamic`, bubbles that fit the message content.
 */
export function bubbleLayout(value: unknown): BubbleLayoutName {
	return value === BubbleLayout.card ? BubbleLayout.card : BubbleLayout.dynamic;
}

/**
 * @description Reads a `#rgb` or `#rrggbb` color.
 * @param value The stored setting.
 * @returns The color's channels from 0 to 1, or `undefined` when it is not a hex color.
 */
export function parseHexColor(value: unknown): Omit<BubbleColor, 'alpha'> | undefined {
	if (typeof value !== 'string') return;

	const digits = value.trim().replace(/^#/, '');
	const expanded =
		digits.length === 3 ? [...digits].map((digit) => digit + digit).join('') : digits;

	if (!/^[\da-f]{6}$/i.test(expanded)) return;

	const [red, green, blue] = [0, 2, 4].map(
		(index) => Number.parseInt(expanded.slice(index, index + 2), 16) / 255,
	);

	return { red: red!, green: green!, blue: blue! };
}

/**
 * @description Builds the bubble's look from the plugin's settings.
 * @param read Reads one setting.
 * @param themeColor The bubble color that follows the theme, used while the user sets none.
 * @returns The layout, radius, padding, spacing between bubbles, corner, grouping and tail options, and colors to draw bubbles with, `ownColor` for the user's own messages.
 */
export function bubbleAppearance(
	read: SettingReader,
	themeColor: Omit<BubbleColor, 'alpha'>,
): BubbleAppearance {
	const base = parseHexColor(read('color')) ?? themeColor;
	const own = parseHexColor(read('ownColor')) ?? base;
	const opacity = bounded(read('opacity'), BubbleStyle.opacity, BubbleLimits.opacity);
	const avatarLast = flag(read('avatarLast'), false);
	const percent = (key: string, fallback: number) =>
		bounded(read(key), fallback, BubbleLimits.opacity) / 100;

	return {
		layout: bubbleLayout(read('layout')),
		radius: bounded(read('radius'), BubbleStyle.radius, BubbleLimits.radius),
		horizontalPadding: bounded(
			read('horizontalPadding'),
			BubbleStyle.horizontalPadding,
			BubbleLimits.padding,
		),
		verticalPadding: bounded(
			read('verticalPadding'),
			BubbleStyle.verticalPadding,
			BubbleLimits.padding,
		),
		spacing: bounded(read('spacing'), BubbleStyle.spacing, BubbleLimits.spacing),
		mediaCorners: choice(read('mediaCorners'), MediaCorners),
		cornerCurve: choice(read('cornerCurve'), CornerCurve),
		grouping: choice(read('grouping'), Grouping),
		roundExposed: flag(read('roundExposed'), true),
		roundOuter: flag(read('roundOuter'), true),
		groupSpacing: bounded(read('groupSpacing'), BubbleStyle.groupSpacing, BubbleLimits.spacing),
		joinCurves: flag(read('joinCurves'), true),
		smoothSteps: flag(read('smoothSteps'), true),
		roomyRows: flag(read('roomyRows'), true),
		avatarLast,
		nameInside: flag(read('nameInside'), true),
		reply: replyStyle(read('reply'), avatarLast),
		tail: !flag(read('tail'), false)
			? TailPosition.off
			: avatarLast
				? TailPosition.last
				: TailPosition.first,
		tailSize: bounded(read('tailSize'), BubbleStyle.tailSize, BubbleLimits.tailSize),
		color: { ...base, alpha: opacity / 100 },
		ownColor: { ...own, alpha: opacity / 100 },
		blur: opacity < BubbleLimits.opacity ? BLUR_RADIUS[choice(read('blur'), BubbleBlur)] : 0,
		mention: {
			color: parseHexColor(read('mentionColor')),
			alpha: percent('mentionOpacity', BubbleStyle.mentionOpacity),
			width: bounded(
				read('mentionWidth'),
				BubbleStyle.mentionWidth,
				BubbleLimits.mentionWidth,
				MENTION_WIDTH_STEP,
			),
			tint: percent('mentionTint', BubbleStyle.mentionTint),
		},
	};
}

export type RowRoom = { top: number; bottom: number };

export type Padding = { horizontal: number; vertical: number };

type Move = { x: number; y: number };

/** How a row's name, avatar and reply preview move while they sit outside its bubble. */
export type HeadingMoves = { name: Move; avatar: Move; reply: Move };

export type RowRooms = {
	/** A row that starts a group, showing the author's name. */
	first: RowRoom;
	/** A row that continues a group. */
	next: RowRoom;
	/** A row that starts a group and replies to a message. */
	reply: RowRoom;
};

/** Rows that keep Discord's height. */
export const NO_ROW_ROOM: RowRooms = {
	first: { top: 0, bottom: 0 },
	next: { top: 0, bottom: 0 },
	reply: { top: 0, bottom: 0 },
};

/**
 * @description Tells whether the author's name and a reply's preview move inside the first bubble, which needs fitted bubbles in rows with room.
 * @param appearance The bubble's look.
 * @returns Whether they move inside.
 */
export function namesInside({ nameInside, roomyRows, layout }: BubbleAppearance): boolean {
	return nameInside && roomyRows && layout === BubbleLayout.dynamic;
}

/**
 * @description Tells whether a reply's preview sits in a quote box inside the bubble, which needs rows with room, and in fitted bubbles the name inside too.
 * @param appearance The bubble's look.
 * @returns Whether replies are quoted inside.
 */
export function repliesQuoted(appearance: BubbleAppearance): boolean {
	const { reply, roomyRows, layout } = appearance;

	return (
		reply === ReplyStyle.quote &&
		roomyRows &&
		(layout === BubbleLayout.card || namesInside(appearance))
	);
}

/**
 * @description Works out the room between a bubble's edges and the name and quote box it holds.
 * @param appearance The bubble's look.
 * @returns The padding in points: a card's reach plus the row inset, otherwise the bubble's padding.
 */
export function headingPadding(appearance: BubbleAppearance): Padding {
	if (appearance.layout === BubbleLayout.dynamic) {
		return { horizontal: appearance.horizontalPadding, vertical: appearance.verticalPadding };
	}

	const { horizontal, vertical } = cardPadding(appearance);

	return { horizontal: horizontal + rowInset(appearance), vertical };
}

// A quoted reply needs room for its box; one above a bubble holding the name needs room to clear the bubble's top padding.
function replyRoom(appearance: BubbleAppearance): number {
	if (repliesQuoted(appearance)) return Quote.room;

	return namesInside(appearance) ? Quote.above : 0;
}

/**
 * @description Works out how much each message row grows above and below its content for its bubble to keep its padding and spacing.
 * @param appearance The bubble's look.
 * @returns The room in points. Joined rows keep a group's lines close, so the first row of the next group also holds the bottom padding the last bubble above hangs into it. A reply's row grows by the room its preview needs.
 */
export function rowRooms(appearance: BubbleAppearance): RowRooms {
	const { roomyRows, layout, grouping, verticalPadding, spacing } = appearance;
	const even = (room: number) => ({ top: room, bottom: room });
	const withReply = (rooms: Omit<RowRooms, 'reply'>): RowRooms => ({
		...rooms,
		reply: { ...rooms.first, top: rooms.first.top + replyRoom(appearance) },
	});

	if (!roomyRows) return NO_ROW_ROOM;

	if (layout === BubbleLayout.card) {
		const card = spacing / 2 + CardPadding.vertical;

		return withReply({ first: even(card), next: even(card) });
	}

	const outer = verticalPadding + spacing / 2;

	if (grouping !== Grouping.joined) return withReply({ first: even(outer), next: even(outer) });

	const inner = Math.min(JOINED_ROW_ROOM, outer);

	return withReply({ first: { top: outer * 2 - inner, bottom: inner }, next: even(inner) });
}

/**
 * @description Works out how far Discord must lay a message's content in from each side, so a fitted bubble starts in line with the author's name and keeps its padding inside the column.
 * @param appearance The bubble's look.
 * @returns The inset in points: the horizontal padding for fitted bubbles with roomy rows, otherwise 0.
 */
export function rowInset({ roomyRows, layout, horizontalPadding }: BubbleAppearance): number {
	if (!roomyRows) return 0;

	// A card keeps its left edge where the tight card's was, so it stays clear of the avatar.
	return layout === BubbleLayout.dynamic
		? horizontalPadding
		: CardPadding.horizontal - CardPadding.tight;
}

/**
 * @description Works out how a row's name, avatar and reply preview move while they sit outside its bubble: up into the room a fitted row makes, or for a card, the name in line with the content and the reply clear of the card's taller top.
 * @param appearance The bubble's look.
 * @returns Each view's move in points.
 */
export function headingMoves(appearance: BubbleAppearance): HeadingMoves {
	const { roomyRows, layout, verticalPadding } = appearance;
	const up = (amount: number) => ({ x: 0, y: amount ? -amount : 0 });

	if (layout === BubbleLayout.card) {
		return {
			name: { x: rowInset(appearance), y: 0 },
			avatar: up(0),
			reply: up(cardPadding(appearance).vertical),
		};
	}

	const lifted = roomyRows ? verticalPadding : 0;

	return { name: up(lifted), avatar: up(lifted), reply: up(lifted) };
}

/**
 * @description Works out how far a card reaches past Discord's content column. The sides always reach `tight` past it; the row inset lays the content further in.
 * @param appearance The bubble's look.
 * @returns The reach in points: above and below too when rows make room for it.
 */
export function cardPadding({ roomyRows }: BubbleAppearance): Padding {
	return { horizontal: CardPadding.tight, vertical: roomyRows ? CardPadding.vertical : 0 };
}

/**
 * @description Works out how far below a fitted bubble's content Discord must lay its accessories, such as reactions, so they sit under the bubble rather than inside its padding.
 * @param appearance The bubble's look.
 * @returns The gap in points: the vertical padding for fitted bubbles, otherwise 0, as a card wraps its accessories.
 */
export function accessoryGap({ layout, verticalPadding }: BubbleAppearance): number {
	return layout === BubbleLayout.dynamic ? verticalPadding : 0;
}

/**
 * @description Packs a bubble color into an Android ARGB integer.
 * @param color The color.
 * @returns The signed 32-bit ARGB value.
 */
export function argb({ red, green, blue, alpha }: BubbleColor): number {
	const channel = (value: number) => Math.round(value * 255);

	return (
		(channel(alpha) << 24) | (channel(red) << 16) | (channel(green) << 8) | channel(blue) | 0
	);
}

export default {
	accessoryGap,
	argb,
	bubbleAppearance,
	bubbleLayout,
	cardPadding,
	choice,
	headingMoves,
	headingPadding,
	namesInside,
	parseHexColor,
	repliesQuoted,
	replyStyle,
	rowInset,
	rowRooms,
};
