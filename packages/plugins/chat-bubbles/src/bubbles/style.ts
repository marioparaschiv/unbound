import {
	BubbleLayout,
	BubbleLimits,
	BubbleStyle,
	CornerCurve,
	Grouping,
	JOINED_ROW_ROOM,
	MediaCorners,
	MENTION_WIDTH_STEP,
	Quote,
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
	/** Whether the author's name, the time and a reply's preview sit inside the group's first bubble. */
	nameInside: boolean;
	tail: ValueOf<typeof TailPosition>;
	tailSize: number;
	color: BubbleColor;
	ownColor: BubbleColor;
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
		avatarLast: flag(read('avatarLast'), false),
		nameInside: flag(read('nameInside'), true),
		tail: choice(read('tail'), TailPosition),
		tailSize: bounded(read('tailSize'), BubbleStyle.tailSize, BubbleLimits.tailSize),
		color: { ...base, alpha: opacity / 100 },
		ownColor: { ...own, alpha: opacity / 100 },
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
 * @description Works out how much each message row grows above and below its content for its bubble to keep its padding and spacing.
 * @param appearance The bubble's look.
 * @returns The room in points. Joined rows keep a group's lines close, so the first row of the next group also holds the bottom padding the last bubble above hangs into it. A reply's row grows by the quote's room when names sit inside.
 */
export function rowRooms(appearance: BubbleAppearance): RowRooms {
	const { roomyRows, layout, grouping, verticalPadding, spacing } = appearance;
	const even = (room: number) => ({ top: room, bottom: room });
	const withReply = (rooms: Omit<RowRooms, 'reply'>): RowRooms => ({
		...rooms,
		reply: namesInside(appearance)
			? { ...rooms.first, top: rooms.first.top + Quote.room }
			: rooms.first,
	});

	if (!roomyRows) return NO_ROW_ROOM;

	if (layout === BubbleLayout.card) {
		return withReply({ first: even(spacing / 2), next: even(spacing / 2) });
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
	return roomyRows && layout === BubbleLayout.dynamic ? horizontalPadding : 0;
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
	choice,
	namesInside,
	parseHexColor,
	rowInset,
	rowRooms,
};
