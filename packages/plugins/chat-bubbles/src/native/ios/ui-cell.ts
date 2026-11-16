import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';

import type { Box } from '~/lib/geometry';
import type { BubbleColor } from '~/lib/style';
import { lastAvatarFrame } from '~/native/ios/last-avatar';
import { messageIdOf } from '~/native/ios/message-id';
import { placeFollowingSwipe } from '~/native/ios/swipe-follow';
import { ReplyIcon } from '~/lib/constants';

export const AVATAR_TAG = 0x0b0b26;
const PICTURE_TAG = 0x0b0b27;
const DECORATION_TAG = 0x0b0b28;
const QUOTE_TAG = 0x0b0b29;
const REPLY_ICON_TAG = 0x0b0b2a;
const REPLY_BUBBLE_TAG = 0x0b0b2b;
const OBJECT_REPLACEMENT = '\uFFFC';
const POP_ISOLATE = 0x2069;
const ISOLATE_STARTS = [0x2066, 0x2067, 0x2068];
const ELLIPSIS = '\u2026';
const TRUNCATE_END = 2;
const MAX_REFITS = 4;
const WIDTH_SLACK = 0.5;
const PREVIEW_WIDTHS_KEY = '__unboundChatBubblesPreviewWidths';
const PREVIEW_LABEL_CLASS = 'DCDReusableYYLabel';
const REPLY_SYMBOL = { name: 'arrowshape.turn.up.left.fill', top: 2 };
const MAX_PICTURES = 128;
const SPINE_CLASS = 'DCDSpine';

/** How far a view's drawing moves, in points. */
export type CellMove = { x: number; y: number };

/** The box a reply's preview sits in: its frame in the bubble, the preview's clip in the reply holder, and its colors. */
export type CellQuote = {
	box: Box;
	clip: Box;
	color: BubbleColor;
	radius: number;
};

/** A reply preview drawn as its own bubble: its color, radius and padding around the avatar and text. */
export type CellReplyBubble = { color: BubbleColor; radius: number; padding: number };

/** Whose avatar a row shows, and whether it starts or ends the author's group. */
export type CellAvatar = { author: string; start: boolean; end: boolean };

/** Everything a cell shows besides its bubble, applied in the same layout pass as the bubble. */
export type CellPaint = {
	/** The name row, the avatar's holder and the reply preview's holder. */
	name: CellMove;
	avatar: CellMove;
	reply: CellMove;
	/** The timestamp's frame in the name row. */
	time?: Box;
	/** How wide the name and its tags may draw before the time. */
	nameClip?: number;
	/** Whether the timestamp hides to leave the name's tags room. */
	hideTime?: boolean;
	quote?: CellQuote;
	replyBubble?: CellReplyBubble;
	picture?: CellAvatar;
};

/** How a cell whose message was never measured is laid out until it is. */
export type CellFallback = {
	name: CellMove;
	avatar: CellMove;
	reply: CellMove;
	hideStart: boolean;
};

type Picture = {
	contents: NativeObjectHandle;
	radius: number;
	/** The avatar's frame in its row. */
	avatar: Box;
	/** The decoration's image and its frame around the avatar. */
	decoration: { image: NativeObjectHandle; frame: Box } | null;
};

/** A drawn bubble's frame in its cell and what else the cell shows. */
export type PaintedCell = Box & { paint?: CellPaint };

export type CellState = {
	pictures: Map<string, Picture>;
	/** The rows that end a group and wait for its picture, by author, then message id. */
	waiting: Map<string, Map<string, NativeObjectHandle>>;
};

type BoxedRect = {
	value?: BoxedRect;
	origin?: BoxedRect;
	size?: BoxedRect;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
};

const NO_MOVE = { x: 0, y: 0 };

function readBox(raw: unknown): Box {
	'worklet';
	const boxed = raw as BoxedRect | null;
	const value = boxed?.value ?? boxed;
	const origin = value?.origin?.value ?? value?.origin;
	const size = value?.size?.value ?? value?.size;

	return {
		x: Number(origin?.x ?? 0),
		y: Number(origin?.y ?? 0),
		width: Number(size?.width ?? 0),
		height: Number(size?.height ?? 0),
	};
}

function readSize(raw: unknown): { width: number; height: number } {
	'worklet';
	const boxed = raw as {
		value?: { width?: number; height?: number };
		width?: number;
		height?: number;
	} | null;
	const value = boxed?.value ?? boxed;

	return { width: Number(value?.width ?? 0), height: Number(value?.height ?? 0) };
}

function cgRect(objc: NativeObjCBridge, { x, y, width, height }: Box) {
	'worklet';

	return objc.struct('CGRect', { origin: { x, y }, size: { width, height } });
}

function uiColor(objc: NativeObjCBridge, { red, green, blue, alpha }: BubbleColor) {
	'worklet';

	return objc.call(
		objc.getClass('UIColor') as NativeObjectHandle,
		'colorWithRed:green:blue:alpha:',
		red,
		green,
		blue,
		alpha,
	);
}

function subviewsOf(objc: NativeObjCBridge, view: NativeObjectHandle): NativeObjectHandle[] {
	'worklet';
	// UNKNOWN: `subviews` comes back as a JS array or an `NSArray` handle.
	const list = objc.invoke(view, 'subviews', []) as unknown;

	return (
		Array.isArray(list) ? list : list ? objc.array(list as NativeObjectHandle) : []
	) as NativeObjectHandle[];
}

// Moving the bounds origin shifts what a view draws: Discord sets only frames when it lays a cell out, which keep the origin.
function moveView(objc: NativeObjCBridge, view: NativeObjectHandle | null, move: CellMove) {
	'worklet';

	if (!view) return;

	const bounds = readBox(objc.invoke(view, 'bounds', []));
	const x = move.x ? -move.x : 0;
	const y = move.y ? -move.y : 0;

	if (bounds.x === x && bounds.y === y) return;

	objc.invoke(view, 'setBounds:', [
		cgRect(objc, { x, y, width: bounds.width, height: bounds.height }),
	]);
}

function moveViews(
	objc: NativeObjCBridge,
	cell: NativeObjectHandle,
	moves: Pick<CellPaint, 'name' | 'avatar' | 'reply'>,
) {
	'worklet';
	moveView(
		objc,
		objc.getIvar(cell, '_messageHeaderView') as NativeObjectHandle | null,
		moves.name,
	);
	moveView(
		objc,
		objc.getIvar(cell, '_avatarWrapperView') as NativeObjectHandle | null,
		moves.avatar,
	);
	moveView(objc, objc.getIvar(cell, '_headerView') as NativeObjectHandle | null, moves.reply);
}

function nameRowOf(objc: NativeObjCBridge, cell: NativeObjectHandle): NativeObjectHandle | null {
	'worklet';
	const header = objc.getIvar(cell, '_messageHeaderView') as NativeObjectHandle | null;
	const time = objc.getIvar(cell, '_timestampLabel') as NativeObjectHandle | null;

	if (!header) return null;

	let widest: NativeObjectHandle | null = null;
	let widestWidth = 0;

	for (const view of subviewsOf(objc, header)) {
		if (time && objc.call(view, 'isEqual:', time)) continue;

		const width = readBox(objc.invoke(view, 'frame', [])).width;

		if (width > widestWidth) {
			widest = view;
			widestWidth = width;
		}
	}

	return widest;
}

function clipName(objc: NativeObjCBridge, cell: NativeObjectHandle, width: number | undefined) {
	'worklet';
	const row = nameRowOf(objc, cell);

	if (!row) return;

	const layer = objc.invoke(row, 'layer', []) as NativeObjectHandle;
	const mask = objc.invoke(layer, 'mask', []) as NativeObjectHandle | null;

	if (width === undefined) {
		if (mask) objc.invoke(layer, 'setMask:', [null]);

		return;
	}

	const height = readBox(objc.invoke(row, 'bounds', [])).height;
	const clip =
		mask ??
		(objc.call(
			objc.getClass('CALayer') as NativeObjectHandle,
			'new',
		) as NativeObjectHandle | null);

	if (!clip) return;

	objc.invoke(clip, 'setFrame:', [cgRect(objc, { x: 0, y: 0, width, height })]);

	if (!mask) {
		objc.invoke(clip, 'setBackgroundColor:', [
			objc.invoke(
				objc.call(
					objc.getClass('UIColor') as NativeObjectHandle,
					'blackColor',
				) as NativeObjectHandle,
				'CGColor',
				[],
			),
		]);
		objc.invoke(layer, 'setMask:', [clip]);
	}
}

function spineOf(
	objc: NativeObjCBridge,
	holder: NativeObjectHandle,
): { preview: NativeObjectHandle; spine: NativeObjectHandle } | undefined {
	'worklet';
	const [preview] = subviewsOf(objc, holder);
	const spine = preview
		? subviewsOf(objc, preview).find((view) => objc.className(view) === SPINE_CLASS)
		: undefined;

	return preview && spine ? { preview, spine } : undefined;
}

function replyIconIn(
	objc: NativeObjCBridge,
	preview: NativeObjectHandle,
): NativeObjectHandle | null {
	'worklet';
	const existing = objc.invoke(preview, 'viewWithTag:', [
		REPLY_ICON_TAG,
	]) as NativeObjectHandle | null;

	if (existing) return existing;

	const image = objc.call(
		objc.getClass('UIImage') as NativeObjectHandle,
		'systemImageNamed:',
		REPLY_SYMBOL.name,
	) as NativeObjectHandle | null;
	const icon = objc.call(
		objc.getClass('UIImageView') as NativeObjectHandle,
		'new',
	) as NativeObjectHandle | null;

	if (!image || !icon) return null;

	objc.invoke(icon, 'setImage:', [image]);
	objc.invoke(icon, 'setTag:', [REPLY_ICON_TAG]);
	// 1 is UIViewContentModeScaleAspectFit.
	objc.invoke(icon, 'setContentMode:', [1]);
	objc.invoke(icon, 'setUserInteractionEnabled:', [false]);
	objc.invoke(icon, 'setTintColor:', [
		objc.call(objc.getClass('UIColor') as NativeObjectHandle, 'secondaryLabelColor'),
	]);
	objc.invoke(preview, 'addSubview:', [icon]);

	return icon;
}

function replyBubbleIn(objc: NativeObjCBridge, preview: NativeObjectHandle) {
	'worklet';
	const existing = objc.invoke(preview, 'viewWithTag:', [
		REPLY_BUBBLE_TAG,
	]) as NativeObjectHandle | null;

	if (existing) return existing;

	const view = objc.call(
		objc.getClass('UIView') as NativeObjectHandle,
		'new',
	) as NativeObjectHandle | null;

	if (!view) return null;

	objc.invoke(view, 'setTag:', [REPLY_BUBBLE_TAG]);
	objc.invoke(view, 'setUserInteractionEnabled:', [false]);
	objc.invoke(preview, 'insertSubview:atIndex:', [view, 0]);

	return view;
}

function contentFrame(objc: NativeObjCBridge, preview: NativeObjectHandle): Box | undefined {
	'worklet';
	let frame: Box | undefined;

	for (const view of subviewsOf(objc, preview)) {
		const tag = objc.invoke(view, 'tag', []);

		if (
			objc.className(view) === SPINE_CLASS ||
			tag === REPLY_ICON_TAG ||
			tag === REPLY_BUBBLE_TAG
		) {
			continue;
		}

		if (objc.invoke(view, 'isHidden', [])) continue;

		const box = readBox(objc.invoke(view, 'frame', []));

		if (box.width <= 0 || box.height <= 0) continue;

		frame = frame
			? {
					x: Math.min(frame.x, box.x),
					y: Math.min(frame.y, box.y),
					width:
						Math.max(frame.x + frame.width, box.x + box.width) -
						Math.min(frame.x, box.x),
					height:
						Math.max(frame.y + frame.height, box.y + box.height) -
						Math.min(frame.y, box.y),
				}
			: box;
	}

	return frame;
}

function paintReplyBubble(
	objc: NativeObjCBridge,
	preview: NativeObjectHandle,
	bubble: CellReplyBubble | undefined,
) {
	'worklet';
	const frame = bubble ? contentFrame(objc, preview) : undefined;
	const view = bubble && frame ? replyBubbleIn(objc, preview) : null;

	if (!bubble || !frame || !view) {
		const existing = objc.invoke(preview, 'viewWithTag:', [REPLY_BUBBLE_TAG]);

		if (existing) objc.invoke(existing as NativeObjectHandle, 'setHidden:', [true]);

		return;
	}

	const { padding } = bubble;

	objc.invoke(view, 'setFrame:', [
		cgRect(objc, {
			x: frame.x - padding,
			y: frame.y - padding / 2,
			width: frame.width + padding * 2,
			height: frame.height + padding,
		}),
	]);
	objc.invoke(view, 'setBackgroundColor:', [uiColor(objc, bubble.color)]);
	objc.invoke(objc.invoke(view, 'layer', []) as NativeObjectHandle, 'setCornerRadius:', [
		bubble.radius,
	]);
	objc.invoke(view, 'setHidden:', [false]);
}

// Bubbles swap Discord's branching spine for a reply icon at its tip, hide both while the preview sits in a quote box, or keep the spine beside a bubble.
function paintSpine(
	objc: NativeObjCBridge,
	holder: NativeObjectHandle | null,
	active: boolean,
	quoted: boolean,
	bubble: CellReplyBubble | undefined,
	keep: boolean,
) {
	'worklet';
	const found = holder ? spineOf(objc, holder) : undefined;

	if (!found) return;

	const { preview, spine } = found;
	const drawn = objc.invoke(preview, 'viewWithTag:', [
		REPLY_BUBBLE_TAG,
	]) as NativeObjectHandle | null;
	const kept = keep && !bubble && Boolean(drawn && !objc.invoke(drawn, 'isHidden', []));
	const bubbled = active && !quoted && (Boolean(bubble) || kept);
	const showIcon = active && !quoted && !bubbled;

	objc.invoke(spine, 'setAlpha:', [active && !bubbled ? 0 : 1]);

	if (!kept) paintReplyBubble(objc, preview, bubbled ? bubble : undefined);

	const icon = showIcon
		? replyIconIn(objc, preview)
		: (objc.invoke(preview, 'viewWithTag:', [REPLY_ICON_TAG]) as NativeObjectHandle | null);

	if (!icon) return;

	if (showIcon) {
		const frame = readBox(objc.invoke(spine, 'frame', []));

		objc.invoke(icon, 'setFrame:', [
			cgRect(objc, {
				// The spine's right edge is where the preview's avatar starts.
				x: frame.x + frame.width - ReplyIcon.size - ReplyIcon.gap,
				y: frame.y + REPLY_SYMBOL.top,
				width: ReplyIcon.size,
				height: ReplyIcon.size,
			}),
		]);
	}

	objc.invoke(icon, 'setHidden:', [!showIcon]);
}

function quoteIn(objc: NativeObjCBridge, fill: NativeObjectHandle): NativeObjectHandle | null {
	'worklet';
	const existing = objc.invoke(fill, 'viewWithTag:', [QUOTE_TAG]) as NativeObjectHandle | null;

	if (existing) return existing;

	const UIView = objc.getClass('UIView') as NativeObjectHandle;
	const quote = objc.call(UIView, 'new') as NativeObjectHandle | null;

	if (!quote) return null;

	objc.invoke(quote, 'setTag:', [QUOTE_TAG]);
	objc.invoke(quote, 'setUserInteractionEnabled:', [false]);
	objc.invoke(quote, 'setClipsToBounds:', [true]);
	objc.invoke(fill, 'addSubview:', [quote]);

	return quote;
}

function previewLabelIn(
	objc: NativeObjCBridge,
	holder: NativeObjectHandle,
): NativeObjectHandle | undefined {
	'worklet';
	let level = [holder];

	for (let depth = 0; depth < 5 && level.length; depth++) {
		const next: NativeObjectHandle[] = [];

		for (const view of level) {
			if ((objc.className(view) ?? '').includes('YYLabel')) return view;

			next.push(...subviewsOf(objc, view));
		}

		level = next;
	}

	return undefined;
}

function ellipsisLike(objc: NativeObjCBridge, text: NativeObjectHandle): NativeObjectHandle | null {
	'worklet';
	const string = objc.call(text, 'string');
	const plain = typeof string === 'string' ? string : '';
	let index = plain.length - 1;
	let isolated = 0;

	for (; index >= 0; index--) {
		const code = plain.charCodeAt(index);

		if (code === POP_ISOLATE) isolated++;
		else if (ISOLATE_STARTS.includes(code)) isolated = Math.max(0, isolated - 1);
		else if (!isolated && plain[index] !== OBJECT_REPLACEMENT && plain[index].trim() !== '')
			break;
	}

	if (index < 0) return null;

	const sample = objc.invoke(text, 'attributedSubstringFromRange:', [
		objc.struct('NSRange', { location: index, length: 1 }),
	]) as NativeObjectHandle | null;
	const token = sample
		? (objc.invoke(sample, 'mutableCopy', []) as NativeObjectHandle | null)
		: null;

	if (!token) return null;

	objc.invoke(token, 'replaceCharactersInRange:withString:', [
		objc.struct('NSRange', { location: 0, length: 1 }),
		ELLIPSIS,
	]);

	return token;
}

function truncatedLayout(
	objc: NativeObjCBridge,
	layout: NativeObjectHandle,
	width: number,
	replacement?: NativeObjectHandle,
): NativeObjectHandle | null {
	'worklet';
	const container = objc.invoke(layout, 'container', []) as NativeObjectHandle;
	const text = replacement ?? (objc.invoke(layout, 'text', []) as NativeObjectHandle);
	const resized = objc.invoke(container, 'copy', []) as NativeObjectHandle;
	const token = ellipsisLike(objc, text);
	const LayoutClass = objc.getClass(
		objc.className(layout) ?? 'YYTextLayout',
	) as NativeObjectHandle;

	objc.invoke(resized, 'setSize:', [
		objc.struct('CGSize', {
			width,
			height: readSize(objc.invoke(container, 'size', [])).height,
		}),
	]);
	objc.invoke(resized, 'setTruncationType:', [TRUNCATE_END]);
	objc.invoke(resized, 'setMaximumNumberOfRows:', [
		Number(objc.invoke(layout, 'rowCount', [])) || 1,
	]);

	if (token) objc.invoke(resized, 'setTruncationToken:', [token]);

	return objc.call(
		LayoutClass,
		'layoutWithContainer:text:',
		resized,
		text,
	) as NativeObjectHandle | null;
}

function readRange(raw: unknown): { location: number; length: number } {
	'worklet';
	const boxed = raw as {
		value?: { location?: number; length?: number };
		location?: number;
		length?: number;
	} | null;
	const value = boxed?.value ?? boxed;

	return { location: Number(value?.location ?? 0), length: Number(value?.length ?? 0) };
}

function isolateStartAround(plain: string, index: number): number | undefined {
	'worklet';
	const opens: number[] = [];

	for (let position = 0; position < plain.length; position++) {
		const code = plain.charCodeAt(position);

		if (ISOLATE_STARTS.includes(code)) {
			opens.push(position);
		} else if (code === POP_ISOLATE) {
			const open = opens.pop();

			if (open !== undefined && !opens.length && open < index && position >= index) {
				return open;
			}
		}
	}

	return undefined;
}

function cutBeforeIsolate(
	objc: NativeObjCBridge,
	layout: NativeObjectHandle,
	fitted: NativeObjectHandle,
	width: number,
): NativeObjectHandle {
	'worklet';
	const text = objc.invoke(layout, 'text', []) as NativeObjectHandle;
	const string = objc.call(text, 'string');
	const plain = typeof string === 'string' ? string : '';
	const visible = readRange(objc.invoke(fitted, 'visibleRange', []));
	const end = visible.location + visible.length;
	const start = end < plain.length ? isolateStartAround(plain, end) : undefined;
	const token = start === undefined ? null : ellipsisLike(objc, text);

	if (start === undefined || !token) return fitted;

	const kept = objc.invoke(text, 'attributedSubstringFromRange:', [
		objc.struct('NSRange', { location: 0, length: start }),
	]) as NativeObjectHandle | null;
	const trimmed = kept
		? (objc.invoke(kept, 'mutableCopy', []) as NativeObjectHandle | null)
		: null;

	if (!trimmed) return fitted;

	objc.invoke(trimmed, 'appendAttributedString:', [token]);

	return truncatedLayout(objc, layout, width, trimmed) ?? fitted;
}

function fittedLayout(
	objc: NativeObjCBridge,
	layout: NativeObjectHandle,
	width: number,
): NativeObjectHandle | null {
	'worklet';
	const container = objc.invoke(layout, 'container', []) as NativeObjectHandle;
	const laidOut = readSize(objc.invoke(container, 'size', [])).width;

	if (width <= 0 || laidOut <= width + WIDTH_SLACK) return null;

	let fitted = truncatedLayout(objc, layout, width);
	let room = width;

	for (let tries = 0; fitted && tries < MAX_REFITS; tries++) {
		const cut = objc.invoke(fitted, 'truncatedLine', []) as NativeObjectHandle | null;
		const overshoot = cut ? Number(objc.invoke(cut, 'right', [])) - width : 0;

		if (overshoot <= 0) break;

		room -= Math.ceil(overshoot);
		fitted = truncatedLayout(objc, layout, room);
	}

	return fitted ? cutBeforeIsolate(objc, layout, fitted, width) : null;
}

function previewWidths(): Map<string, number> {
	'worklet';
	const holder = globalThis as unknown as Record<
		typeof PREVIEW_WIDTHS_KEY,
		Map<string, number> | undefined
	>;

	holder[PREVIEW_WIDTHS_KEY] ??= new Map();

	return holder[PREVIEW_WIDTHS_KEY];
}

function labelKey(objc: NativeObjCBridge, label: NativeObjectHandle): string {
	'worklet';

	return String(objc.call(label, 'hash') as number);
}

function fitPreviewText(objc: NativeObjCBridge, holder: NativeObjectHandle, clip: Box | undefined) {
	'worklet';
	const label = previewLabelIn(objc, holder);

	if (!label) return;

	if (!clip) {
		previewWidths().delete(labelKey(objc, label));

		return;
	}

	const parent = objc.invoke(label, 'superview', []) as NativeObjectHandle;
	const frame = readBox(objc.invoke(label, 'frame', []));
	const origin = readBox(
		objc.invoke(parent, 'convertRect:toView:', [cgRect(objc, frame), holder]),
	);
	const width = Math.floor(clip.x + clip.width - origin.x);
	const layout = objc.invoke(label, 'textLayout', []) as NativeObjectHandle | null;

	previewWidths().set(labelKey(objc, label), width);

	const fitted = layout ? fittedLayout(objc, layout, width) : null;

	if (fitted) objc.invoke(label, 'setTextLayout:', [fitted]);
}

/**
 * @description Lays a quoted reply's preview out at its quote box's width as Discord sets it, so the text wraps and ends with an ellipsis inside the box instead of running past it.
 * @param objc The UI scope's Objective-C bridge.
 */
export function installPreviewFit(objc: NativeObjCBridge) {
	'worklet';
	const widths = previewWidths();
	const labelClass = objc.getClass(PREVIEW_LABEL_CLASS) ? PREVIEW_LABEL_CLASS : 'YYLabel';

	widths.clear();

	if (!objc.getClass(labelClass)) return;

	objc.hook(labelClass, 'setTextLayout:', {
		before: (context) => {
			if (!widths.size) return;

			const width = widths.get(labelKey(objc, context.self));
			const layout = context.args[0] as NativeObjectHandle | null;
			const fitted = width !== undefined && layout ? fittedLayout(objc, layout, width) : null;

			if (fitted) context.replaceObjectArgument(0, fitted);
		},
	});
}

// The quote box sits in the bubble's fill, whose mask clips it to the bubble; the preview is clipped to the box.
function paintQuote(
	objc: NativeObjCBridge,
	cell: NativeObjectHandle,
	fill: NativeObjectHandle | null,
	quote: CellQuote | undefined,
	active: boolean,
	bubble?: CellReplyBubble,
	keep = false,
) {
	'worklet';
	const holder = objc.getIvar(cell, '_headerView') as NativeObjectHandle | null;
	const layer = holder ? (objc.invoke(holder, 'layer', []) as NativeObjectHandle) : null;

	paintSpine(objc, holder, active, Boolean(quote), bubble, keep);

	if (!quote) {
		const existing = fill && objc.invoke(fill, 'viewWithTag:', [QUOTE_TAG]);

		if (existing) objc.invoke(existing as NativeObjectHandle, 'setHidden:', [true]);

		if (layer && objc.invoke(layer, 'mask', [])) objc.invoke(layer, 'setMask:', [null]);

		if (holder) fitPreviewText(objc, holder, undefined);

		return;
	}

	const view = fill ? quoteIn(objc, fill) : null;

	if (view) {
		objc.invoke(view, 'setFrame:', [cgRect(objc, quote.box)]);
		objc.invoke(view, 'setBackgroundColor:', [uiColor(objc, quote.color)]);
		objc.invoke(objc.invoke(view, 'layer', []) as NativeObjectHandle, 'setCornerRadius:', [
			quote.radius,
		]);
		objc.invoke(view, 'setHidden:', [false]);
	}

	if (!layer) return;

	let mask = objc.invoke(layer, 'mask', []) as NativeObjectHandle | null;

	if (!mask) {
		mask = objc.call(
			objc.getClass('CALayer') as NativeObjectHandle,
			'new',
		) as NativeObjectHandle;
		objc.invoke(mask, 'setBackgroundColor:', [
			objc.invoke(
				objc.call(
					objc.getClass('UIColor') as NativeObjectHandle,
					'blackColor',
				) as NativeObjectHandle,
				'CGColor',
				[],
			),
		]);
		objc.invoke(layer, 'setMask:', [mask]);
	}

	objc.invoke(mask, 'setFrame:', [cgRect(objc, quote.clip)]);
	fitPreviewText(objc, holder as NativeObjectHandle, quote.clip);
}

function capture(objc: NativeObjCBridge, cell: NativeObjectHandle): Picture | undefined {
	'worklet';
	const avatar = objc.getIvar(cell, '_avatarView') as NativeObjectHandle | null;
	const layer = avatar ? (objc.invoke(avatar, 'layer', []) as NativeObjectHandle) : null;
	const contents = layer
		? (objc.invoke(layer, 'contents', []) as NativeObjectHandle | null)
		: null;

	if (!avatar || !layer || !contents) return;

	const decorationView = objc.getIvar(cell, '_decorationView') as NativeObjectHandle | null;
	const image =
		decorationView && !objc.invoke(decorationView, 'isHidden', [])
			? (objc.invoke(decorationView, 'image', []) as NativeObjectHandle | null)
			: null;
	const own = readBox(objc.invoke(avatar, 'frame', []));
	const around = image ? readBox(objc.invoke(decorationView!, 'frame', [])) : own;
	// The holder's move shifts the conversion down, never across, so only the avatar's left edge and size are kept.
	const inCell = readBox(
		objc.invoke(avatar, 'convertRect:toView:', [
			cgRect(objc, { x: 0, y: 0, width: own.width, height: own.height }),
			cell,
		]),
	);

	return {
		contents,
		radius: Number(objc.invoke(layer, 'cornerRadius', [])) || 0,
		avatar: { x: inCell.x, y: 0, width: own.width, height: own.height },
		decoration: image
			? {
					image,
					frame: {
						x: around.x - own.x,
						y: around.y - own.y,
						width: around.width,
						height: around.height,
					},
				}
			: null,
	};
}

function pictureView(objc: NativeObjCBridge, cell: NativeObjectHandle): NativeObjectHandle | null {
	'worklet';
	const existing = objc.invoke(cell, 'viewWithTag:', [AVATAR_TAG]) as NativeObjectHandle | null;

	if (existing) return existing;

	const UIView = objc.getClass('UIView') as NativeObjectHandle;
	// An animated image view keeps an animated decoration moving.
	const ImageView = objc.getClass('SDAnimatedImageView') ?? objc.getClass('UIImageView');
	const holder = objc.call(UIView, 'new') as NativeObjectHandle | null;
	const picture = objc.call(UIView, 'new') as NativeObjectHandle | null;
	const decoration = ImageView
		? (objc.call(ImageView, 'new') as NativeObjectHandle | null)
		: null;

	if (!holder || !picture) return null;

	objc.invoke(holder, 'setTag:', [AVATAR_TAG]);
	objc.invoke(holder, 'setUserInteractionEnabled:', [false]);
	objc.invoke(picture, 'setTag:', [PICTURE_TAG]);
	objc.invoke(objc.invoke(picture, 'layer', []) as NativeObjectHandle, 'setMasksToBounds:', [
		true,
	]);
	objc.invoke(holder, 'addSubview:', [picture]);

	if (decoration) {
		objc.invoke(decoration, 'setTag:', [DECORATION_TAG]);
		objc.invoke(holder, 'addSubview:', [decoration]);
	}

	objc.invoke(cell, 'addSubview:', [holder]);

	return holder;
}

function showPicture(
	objc: NativeObjCBridge,
	cell: NativeObjectHandle,
	picture: Picture,
	bubble: Box,
) {
	'worklet';
	const holder = pictureView(objc, cell);
	const view =
		holder && (objc.invoke(holder, 'viewWithTag:', [PICTURE_TAG]) as NativeObjectHandle | null);
	const decoration =
		holder &&
		(objc.invoke(holder, 'viewWithTag:', [DECORATION_TAG]) as NativeObjectHandle | null);

	if (!holder || !view) return;

	const frame = lastAvatarFrame(bubble, picture.avatar);
	const layer = objc.invoke(view, 'layer', []) as NativeObjectHandle;
	placeFollowingSwipe(objc, holder, cgRect(objc, frame));
	objc.invoke(view, 'setFrame:', [
		cgRect(objc, { x: 0, y: 0, width: frame.width, height: frame.height }),
	]);
	objc.invoke(layer, 'setContents:', [picture.contents]);
	objc.invoke(layer, 'setCornerRadius:', [picture.radius]);

	if (decoration) {
		if (picture.decoration) {
			objc.invoke(decoration, 'setImage:', [picture.decoration.image]);
			objc.invoke(decoration, 'setFrame:', [cgRect(objc, picture.decoration.frame)]);
		}

		objc.invoke(decoration, 'setHidden:', [!picture.decoration]);
	}

	objc.invoke(holder, 'setHidden:', [false]);
}

function hidePicture(objc: NativeObjCBridge, cell: NativeObjectHandle) {
	'worklet';
	const holder = objc.invoke(cell, 'viewWithTag:', [AVATAR_TAG]) as NativeObjectHandle | null;

	if (holder) objc.invoke(holder, 'setHidden:', [true]);
}

function setAvatarShown(objc: NativeObjCBridge, cell: NativeObjectHandle, shown: boolean) {
	'worklet';
	const wrapper = objc.getIvar(cell, '_avatarWrapperView') as NativeObjectHandle | null;

	if (wrapper) objc.invoke(wrapper, 'setAlpha:', [shown ? 1 : 0]);
}

function unqueue(state: CellState, messageId: string) {
	'worklet';
	for (const [author, rows] of state.waiting) {
		rows.delete(messageId);

		if (!rows.size) state.waiting.delete(author);
	}
}

// Each first row keeps its own copy of the picture, so a new copy only draws the last rows waiting for it.
function remember(
	objc: NativeObjCBridge,
	state: CellState,
	cache: Map<string, PaintedCell>,
	author: string,
	picture: Picture,
) {
	'worklet';
	state.pictures.delete(author);
	state.pictures.set(author, picture);

	if (state.pictures.size > MAX_PICTURES) {
		state.pictures.delete(state.pictures.keys().next().value as string);
	}

	const rows = state.waiting.get(author);

	state.waiting.delete(author);

	for (const [messageId, cell] of rows ?? []) {
		const painted = cache.get(messageId);

		if (painted?.paint?.picture?.end && messageIdOf(objc, cell) === messageId) {
			showPicture(objc, cell, picture, painted);
		}
	}
}

function paintPicture(
	objc: NativeObjCBridge,
	state: CellState,
	cache: Map<string, PaintedCell>,
	cell: NativeObjectHandle,
	painted: PaintedCell,
	messageId: string | undefined,
) {
	'worklet';
	const place = painted.paint?.picture;

	if (messageId) unqueue(state, messageId);

	setAvatarShown(objc, cell, !place?.start);

	if (!place) return hidePicture(objc, cell);

	if (place.start) {
		const picture = capture(objc, cell);

		if (picture) remember(objc, state, cache, place.author, picture);
	}

	const picture = place.end ? state.pictures.get(place.author) : undefined;

	if (picture) return showPicture(objc, cell, picture, painted);

	hidePicture(objc, cell);

	if (place.end && messageId) {
		state.waiting.set(
			place.author,
			(state.waiting.get(place.author) ?? new Map()).set(messageId, cell),
		);
	}
}

/**
 * @description Applies everything a measured cell shows besides its bubble: the moved name, time, avatar and reply preview, the quote box and the avatar by the group's last bubble.
 * @param objc The Objective-C bridge.
 * @param state The avatar pictures seen and the rows waiting for them.
 * @param cache The drawn cells by message id.
 * @param cell The message cell.
 * @param fill The bubble's fill view, which holds the quote box.
 * @param painted The bubble's frame and what else the cell shows.
 * @param messageId The message the cell shows.
 */
export function paintCell(
	objc: NativeObjCBridge,
	state: CellState,
	cache: Map<string, PaintedCell>,
	cell: NativeObjectHandle,
	fill: NativeObjectHandle | null,
	painted: PaintedCell,
	messageId: string | undefined,
) {
	'worklet';
	const paint = painted.paint;

	moveViews(objc, cell, paint ?? { name: NO_MOVE, avatar: NO_MOVE, reply: NO_MOVE });

	const time = objc.getIvar(cell, '_timestampLabel') as NativeObjectHandle | null;

	if (time && paint?.time) objc.invoke(time, 'setFrame:', [cgRect(objc, paint.time)]);

	if (time) objc.invoke(time, 'setAlpha:', [paint?.hideTime ? 0 : 1]);

	clipName(objc, cell, paint?.nameClip);

	paintQuote(objc, cell, fill, paint?.quote, true, paint?.replyBubble, !paint);
	paintPicture(objc, state, cache, cell, painted, messageId);
}

/**
 * @description Lays out a cell whose message was never measured the way most first rows end up, so it does not show Discord's layout until it is measured.
 * @param objc The Objective-C bridge.
 * @param cell The message cell.
 * @param fallback The moves of a first row without a reply, and whether its avatar hides.
 */
export function paintUnmeasured(
	objc: NativeObjCBridge,
	cell: NativeObjectHandle,
	fallback: CellFallback,
) {
	'worklet';
	const header = objc.getIvar(cell, '_messageHeaderView') as NativeObjectHandle | null;
	const holder = objc.getIvar(cell, '_headerView') as NativeObjectHandle | null;

	// Rows that continue a group hide their name; a reply's preview moves by its own measured height.
	if (!header || objc.invoke(header, 'isHidden', [])) return;

	if (holder && readBox(objc.invoke(holder, 'frame', [])).height > 0) return;

	moveViews(objc, cell, fallback);
	setAvatarShown(objc, cell, !fallback.hideStart);
}

/**
 * @description Gives a cell back Discord's own layout: views unmoved, the reply preview unclipped and Discord's avatar shown.
 * @param objc The Objective-C bridge.
 * @param cell The message cell.
 */
export function resetCell(objc: NativeObjCBridge, cell: NativeObjectHandle) {
	'worklet';
	moveViews(objc, cell, { name: NO_MOVE, avatar: NO_MOVE, reply: NO_MOVE });
	clipName(objc, cell, undefined);

	const time = objc.getIvar(cell, '_timestampLabel') as NativeObjectHandle | null;

	if (time) objc.invoke(time, 'setAlpha:', [1]);
	paintQuote(objc, cell, null, undefined, false);
	setAvatarShown(objc, cell, true);
	hidePicture(objc, cell);
}

export default { paintCell, paintUnmeasured, resetCell };
