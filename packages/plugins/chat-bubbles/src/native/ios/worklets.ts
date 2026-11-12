import type {
	NativeObjCBridge,
	NativeObjectHandle,
	NativeUICallback,
	NativeUIScope,
} from '@unbound-app/api/native';

import type { Fillets } from '~/lib/group';
import type { BubbleColor } from '~/lib/style';
import { messageIdOf, messageIdOfViewModel } from '~/native/ios/message-id';
import { paintBlur } from '~/native/ios/ui-blur';
import {
	paintCell,
	paintUnmeasured,
	resetCell,
	type CellFallback,
	type CellPaint,
	type CellState,
} from '~/native/ios/ui-cell';
import { isStandaloneCell } from '~/native/ios/standalone-cell';
import { hostOffset } from '~/native/ios/host-offset';

const STATE_KEY = '__unboundChatBubbles';
const MAX_CACHED = 400;
const WIDTH_TOLERANCE = 1;
const FILLET_TAGS = { top: 0x0b0b21, bottom: 0x0b0b22 };
const FILLET_RING_TAG = 0x0b0b23;
const FILL_TAG = 0x0b0b24;
const OUTLINE_TAG = 0x0b0b25;

export type BubbleClasses = {
	messageCell: string;
	separatorCell: string;
	bubbleTag: number;
};

export type CachedBubble = {
	x: number;
	y: number;
	width: number;
	height: number;
	cellWidth: number;
	radius: number;
	/** The rounded corners, as a `CACornerMask`. */
	corners: number;
	/** Whether the corners use Apple's continuous (squircle) curve rather than a circular one. */
	continuous: boolean;
	/** The bubble's outline, each corner with its own radius and its tail, from `bubblePath`. */
	path: number[][];
	/** How far the outline's tail reaches left of the bubble, in points; 0 without one. */
	tailSize: number;
	/** The inward curves at the top and bottom right that join the bubble to a wider neighbour it touches. */
	fillets: Fillets;
	color: BubbleColor;
	/** How far what lies behind the bubble blurs, in points; 0 for none. */
	blur: number;
	/** The outline of a bubble whose message mentions the user, and its width in points. */
	border?: { color: BubbleColor; width: number };
	/** What else the cell shows: moved name, time and reply, the quote box and the avatar. */
	paint?: CellPaint;
};

type ColorEvent = {
	self: NativeObjectHandle;
	args: unknown[];
};

type BoxedRect = {
	value?: BoxedRect;
	size?: BoxedRect;
	width?: number;
};

type BubbleState = {
	cache: Map<string, CachedBubble>;
	objc: NativeObjCBridge;
	clear: NativeObjectHandle | null;
	remeasure: NativeUICallback<[string]>;
	cells: CellState;
	/** How a cell whose message was never measured is laid out, `null` to leave it to Discord. */
	fallback: CellFallback | null;
};

type StateHolder = Record<typeof STATE_KEY, BubbleState | undefined>;

function holder(): StateHolder {
	'worklet';

	return globalThis as unknown as StateHolder;
}

function clearColor(objc: NativeObjCBridge): NativeObjectHandle | null {
	'worklet';
	const UIColor = objc.getClass('UIColor');

	return UIColor ? (objc.call(UIColor, 'clearColor') as NativeObjectHandle) : null;
}

function report(error: unknown) {
	'worklet';
	console.error(`[Chat Bubbles] ${String(error)}`);
}

function cellWidthOf(objc: NativeObjCBridge, cell: NativeObjectHandle): number {
	'worklet';
	const raw = objc.invoke(cell, 'bounds', []) as BoxedRect | null;
	const rect = raw?.value ?? raw;

	return Number((rect?.size ?? rect)?.width ?? 0);
}

function bubbleIn(
	objc: NativeObjCBridge,
	cell: NativeObjectHandle,
	tag: number,
): NativeObjectHandle | null {
	'worklet';
	const existing = objc.invoke(cell, 'viewWithTag:', [tag]) as NativeObjectHandle | null;

	if (existing) {
		return existing;
	}

	const bubble = objc.call(
		objc.getClass('UIView') as NativeObjectHandle,
		'new',
	) as NativeObjectHandle | null;

	if (!bubble) {
		return null;
	}

	objc.invoke(bubble, 'setTag:', [tag]);
	objc.invoke(bubble, 'setUserInteractionEnabled:', [false]);
	// Swipe to reply moves the content view, so the bubble lives in it to move along.
	objc.invoke(
		(objc.invoke(cell, 'contentView', []) as NativeObjectHandle | null) ?? cell,
		'insertSubview:atIndex:',
		[bubble, 0],
	);

	return bubble;
}

function rect(x: number, y: number, width: number, height: number) {
	'worklet';

	return { origin: { x, y }, size: { width, height } };
}

function point(objc: NativeObjCBridge, x: number, y: number) {
	'worklet';

	return objc.struct('CGPoint', { x, y });
}

function outlineOf(objc: NativeObjCBridge, steps: number[][]): unknown {
	'worklet';
	const path = objc.call(
		objc.getClass('UIBezierPath') as NativeObjectHandle,
		'bezierPath',
	) as NativeObjectHandle;

	steps.forEach((step, index) => {
		if (step.length === 6) {
			const [c1x, c1y, c2x, c2y, x, y] = step as [
				number,
				number,
				number,
				number,
				number,
				number,
			];

			objc.invoke(path, 'addCurveToPoint:controlPoint1:controlPoint2:', [
				point(objc, x, y),
				point(objc, c1x, c1y),
				point(objc, c2x, c2y),
			]);
		} else {
			objc.invoke(path, index ? 'addLineToPoint:' : 'moveToPoint:', [
				point(objc, step[0]!, step[1]!),
			]);
		}
	});
	objc.invoke(path, 'closePath', []);

	return objc.invoke(path, 'CGPath', []);
}

// The bubble's shape is a view shown through a shape mask, which, unlike the layer's own corners, gives each corner its own radius.
function maskedIn(
	objc: NativeObjCBridge,
	parent: NativeObjectHandle,
	tag: number,
): NativeObjectHandle | null {
	'worklet';
	const existing = objc.invoke(parent, 'viewWithTag:', [tag]) as NativeObjectHandle | null;

	if (existing) {
		return existing;
	}

	const view = objc.call(
		objc.getClass('UIView') as NativeObjectHandle,
		'new',
	) as NativeObjectHandle;
	const mask = objc.call(objc.getClass('CAShapeLayer') as NativeObjectHandle, 'new');

	if (!view || !mask) {
		return null;
	}

	objc.invoke(view, 'setTag:', [tag]);
	objc.invoke(view, 'setUserInteractionEnabled:', [false]);
	objc.invoke(objc.invoke(view, 'layer', []) as NativeObjectHandle, 'setMask:', [mask]);
	objc.invoke(parent, 'insertSubview:atIndex:', [view, 0]);

	return view;
}

function paintMasked(
	objc: NativeObjCBridge,
	view: NativeObjectHandle,
	drawn: CachedBubble,
	outline: unknown,
	color: unknown,
	stroke: number,
) {
	'worklet';
	const bounds = objc.struct('CGRect', rect(0, 0, drawn.width, drawn.height));
	// The view reaches left over the tail, and its bounds start there too, so the bubble's own coordinates still start at its left edge.
	const reach = objc.struct(
		'CGRect',
		rect(-drawn.tailSize, 0, drawn.width + drawn.tailSize, drawn.height),
	);
	const mask = objc.invoke(
		objc.invoke(view, 'layer', []) as NativeObjectHandle,
		'mask',
		[],
	) as NativeObjectHandle;

	objc.invoke(view, 'setFrame:', [reach]);
	objc.invoke(view, 'setBounds:', [reach]);
	objc.invoke(view, 'setBackgroundColor:', [color]);
	objc.invoke(mask, 'setFrame:', [bounds]);
	objc.invoke(mask, 'setPath:', [outline]);

	if (stroke > 0) {
		const UIColor = objc.getClass('UIColor') as NativeObjectHandle;

		// The stroke is centred on the outline and the fill's mask clips its outer half, so twice the width leaves the width inside.
		objc.invoke(mask, 'setFillColor:', [
			objc.invoke(objc.call(UIColor, 'clearColor') as NativeObjectHandle, 'CGColor', []),
		]);
		objc.invoke(mask, 'setStrokeColor:', [
			objc.invoke(objc.call(UIColor, 'blackColor') as NativeObjectHandle, 'CGColor', []),
		]);
		objc.invoke(mask, 'setLineWidth:', [stroke * 2]);
	}

	objc.invoke(view, 'setHidden:', [false]);
}

// The outline sits inside the fill, whose mask clips the stroke's outer half; the bubble's own bounds would clip it
// only along the straight edges, leaving the corners twice as thick.
function paintOutline(
	objc: NativeObjCBridge,
	UIColor: NativeObjectHandle,
	fill: NativeObjectHandle,
	drawn: CachedBubble,
	outline: unknown,
) {
	'worklet';
	const border = drawn.border;

	if (!border?.width) {
		const existing = objc.invoke(fill, 'viewWithTag:', [OUTLINE_TAG]);

		if (existing) {
			objc.invoke(existing as NativeObjectHandle, 'setHidden:', [true]);
		}

		return;
	}

	const view = maskedIn(objc, fill, OUTLINE_TAG);
	const { red, green, blue, alpha } = border.color;

	if (view) {
		const color = objc.call(UIColor, 'colorWithRed:green:blue:alpha:', red, green, blue, alpha);

		paintMasked(objc, view, drawn, outline, color, border.width);
	}
}

// A fillet clips a ring, a circle drawn by its border alone, to one quarter: the ring's hole cuts the inward curve
// and its border fills the step, so the fillet adds no shape the bubble's color does not already cover.
function filletIn(
	objc: NativeObjCBridge,
	bubble: NativeObjectHandle,
	tag: number,
): NativeObjectHandle | null {
	'worklet';
	const existing = objc.invoke(bubble, 'viewWithTag:', [tag]) as NativeObjectHandle | null;

	if (existing) {
		return existing;
	}

	const UIView = objc.getClass('UIView') as NativeObjectHandle;
	const fillet = objc.call(UIView, 'new') as NativeObjectHandle | null;
	const ring = objc.call(UIView, 'new') as NativeObjectHandle | null;

	if (!fillet || !ring) {
		return null;
	}

	objc.invoke(fillet, 'setTag:', [tag]);
	objc.invoke(fillet, 'setClipsToBounds:', [true]);
	objc.invoke(fillet, 'setUserInteractionEnabled:', [false]);
	objc.invoke(ring, 'setTag:', [FILLET_RING_TAG]);
	objc.invoke(fillet, 'addSubview:', [ring]);
	objc.invoke(bubble, 'addSubview:', [fillet]);

	return fillet;
}

function paintFillet(
	objc: NativeObjCBridge,
	bubble: NativeObjectHandle,
	drawn: CachedBubble,
	side: 'top' | 'bottom',
	color: unknown,
) {
	'worklet';
	const size = drawn.fillets[side];

	if (size <= 0) {
		const existing = objc.invoke(bubble, 'viewWithTag:', [FILLET_TAGS[side]]);

		if (existing) {
			objc.invoke(existing as NativeObjectHandle, 'setHidden:', [true]);
		}

		return;
	}

	const fillet = filletIn(objc, bubble, FILLET_TAGS[side]);
	const ring =
		fillet && (objc.invoke(fillet, 'viewWithTag:', [FILLET_RING_TAG]) as NativeObjectHandle);

	if (!fillet || !ring) {
		return;
	}

	const top = side === 'top';
	const ringLayer = objc.invoke(ring, 'layer', []) as NativeObjectHandle;

	// The fillet sits right of the bubble, against the neighbour's edge; the ring's centre is its far corner.
	objc.invoke(fillet, 'setFrame:', [
		objc.struct('CGRect', rect(drawn.width, top ? 0 : drawn.height - size, size, size)),
	]);
	objc.invoke(ring, 'setFrame:', [
		objc.struct('CGRect', rect(-size, top ? -size : -size * 2, size * 4, size * 4)),
	]);
	objc.invoke(ringLayer, 'setCornerRadius:', [size * 2]);
	objc.invoke(ringLayer, 'setBorderWidth:', [size]);
	objc.invoke(ringLayer, 'setBorderColor:', [
		objc.invoke(color as NativeObjectHandle, 'CGColor', []),
	]);
	objc.invoke(fillet, 'setHidden:', [false]);
}

function paintBubble(
	objc: NativeObjCBridge,
	bubble: NativeObjectHandle,
	drawn: CachedBubble,
): NativeObjectHandle | null {
	'worklet';
	const UIColor = objc.getClass('UIColor');

	if (!UIColor) {
		return null;
	}

	const { red, green, blue, alpha } = drawn.color;
	const layer = objc.invoke(bubble, 'layer', []) as NativeObjectHandle;
	const color = objc.call(UIColor, 'colorWithRed:green:blue:alpha:', red, green, blue, alpha);

	const outline = outlineOf(objc, drawn.path);
	const fill = maskedIn(objc, bubble, FILL_TAG);

	// The outline's tail sits outside the bubble, so the bubble must not clip; its fill view draws the shape.
	objc.invoke(layer, 'setMasksToBounds:', [false]);
	objc.invoke(layer, 'setCornerRadius:', [0]);
	objc.invoke(layer, 'setBorderWidth:', [0]);
	objc.invoke(bubble, 'setBackgroundColor:', [clearColor(objc)]);

	if (fill) {
		paintMasked(objc, fill, drawn, outline, color, 0);
		paintOutline(objc, UIColor, fill, drawn, outline);
		paintBlur(objc, bubble, fill, drawn, outline);
	}

	paintFillet(objc, bubble, drawn, 'top', color);
	paintFillet(objc, bubble, drawn, 'bottom', color);

	const offset = hostOffset(objc, bubble);

	objc.invoke(bubble, 'setFrame:', [
		objc.struct(
			'CGRect',
			rect(drawn.x - offset.x, drawn.y - offset.y, drawn.width, drawn.height),
		),
	]);
	objc.invoke(bubble, 'setHidden:', [false]);

	return fill;
}

// The UI thread can make a cell's bubble while the JS thread makes its own, so the drawn bubble removes any other.
function removeDuplicates(
	objc: NativeObjCBridge,
	cell: NativeObjectHandle,
	bubble: NativeObjectHandle,
) {
	'worklet';
	const tag = String(objc.invoke(bubble, 'tag', []));
	// UNKNOWN: `subviews` comes back as a JS array or an `NSArray` handle.
	const list = objc.invoke(cell, 'subviews', []) as unknown;
	const subviews = (
		Array.isArray(list) ? list : list ? objc.array(list as NativeObjectHandle) : []
	) as NativeObjectHandle[];

	for (const view of subviews) {
		if (
			String(objc.invoke(view, 'tag', [])) === tag &&
			!objc.invoke(view, 'isEqual:', [bubble])
		) {
			objc.invoke(view, 'removeFromSuperview', []);
		}
	}
}

function placeCached(
	objc: NativeObjCBridge,
	current: BubbleState,
	cell: NativeObjectHandle,
	tag: number,
) {
	'worklet';
	const messageId = messageIdOf(objc, cell);
	const cached = messageId ? current.cache.get(messageId) : undefined;

	if (!cached || Math.abs(cellWidthOf(objc, cell) - cached.cellWidth) > WIDTH_TOLERANCE) {
		if (current.fallback) paintUnmeasured(objc, cell, current.fallback);

		return;
	}

	const bubble = bubbleIn(objc, cell, tag);
	const fill = bubble ? paintBubble(objc, bubble, cached) : null;

	paintCell(objc, current.cells, current.cache, cell, fill, cached, messageId);
}

function remember(current: BubbleState, messageId: string, bubble: CachedBubble) {
	'worklet';
	current.cache.delete(messageId);
	current.cache.set(messageId, bubble);

	if (current.cache.size > MAX_CACHED) {
		current.cache.delete(current.cache.keys().next().value as string);
	}
}

/**
 * @description Keeps message and separator cells transparent, hides a reused cell's old bubble, and draws a bubble at once for a message whose layout is already known, from hooks that run on the UI thread, so bubbles never flash or pop in while scrolling back over messages.
 * @param scope The plugin's UI scope.
 * @param classes The cell classes and the bubble view's tag.
 * @param remeasure Called with a cell's key when a bubble measured for it was not drawn, because the cell shows another message by then.
 */
export function installBubbleGuards(
	scope: NativeUIScope,
	classes: BubbleClasses,
	remeasure: NativeUICallback<[string]>,
) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;
	const clear = clearColor(objc);
	const current: BubbleState = {
		cache: new Map(),
		objc,
		clear,
		remeasure,
		cells: { pictures: new Map(), waiting: new Map() },
		fallback: null,
	};

	holder()[STATE_KEY] = current;

	if (!clear) {
		return;
	}

	function keepClear({ self, args }: ColorEvent) {
		const color = args[0] as NativeObjectHandle | null;

		try {
			if (isStandaloneCell(objc, self)) return;

			if (!color || !objc.call(color, 'isEqual:', clear)) {
				objc.invoke(self, 'setBackgroundColor:', [clear]);
			}
		} catch (error) {
			report(error);
		}
	}

	objc.hook(classes.messageCell, 'setBackgroundColor:', { after: keepClear });
	objc.hook(classes.separatorCell, 'setBackgroundColor:', { after: keepClear });
	objc.hook(classes.separatorCell, 'layoutSubviews', {
		after: ({ self }) => {
			try {
				objc.invoke(self, 'setBackgroundColor:', [clear]);
			} catch (error) {
				report(error);
			}
		},
	});
	objc.hook(classes.messageCell, 'prepareForReuse', {
		after: ({ self }) => {
			try {
				const bubble = objc.invoke(self, 'viewWithTag:', [
					classes.bubbleTag,
				]) as NativeObjectHandle | null;

				if (bubble) {
					objc.invoke(bubble, 'setHidden:', [true]);
				}

				resetCell(objc, self);
			} catch (error) {
				report(error);
			}
		},
	});
	objc.hook(classes.messageCell, 'layoutSubviews', {
		after: ({ self }) => {
			try {
				if (isStandaloneCell(objc, self)) return;

				placeCached(objc, current, self, classes.bubbleTag);
			} catch (error) {
				report(error);
			}
		},
	});
}

/**
 * @description Draws a measured bubble in one pass on the UI thread and remembers it for the message's next layout. When the cell shows another message by then, it asks for the cell to be measured again instead.
 * @param key The cell's key.
 * @param cell The message cell.
 * @param bubble The cell's bubble view.
 * @param viewModel The cell's view model when it was measured, or `null` when it had none.
 * @param drawn The bubble's frame in its cell, the cell's width, the corner radius, which corners it rounds and their curve, its tail and joining curves, the color and a mention's border.
 */
export function drawBubble(
	key: string,
	cell: NativeObjectHandle,
	bubble: NativeObjectHandle,
	viewModel: NativeObjectHandle | null,
	drawn: CachedBubble,
) {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) {
		return;
	}

	const { objc, clear } = current;

	try {
		const messageId = messageIdOf(objc, cell);

		if (viewModel && messageId !== messageIdOfViewModel(objc, viewModel)) {
			current.remeasure(key);

			return;
		}

		if (clear) {
			objc.invoke(cell, 'setBackgroundColor:', [clear]);
		}

		const fill = paintBubble(objc, bubble, drawn);

		removeDuplicates(objc, cell, bubble);

		if (messageId) {
			remember(current, messageId, drawn);
		}

		paintCell(objc, current.cells, current.cache, cell, fill, drawn, messageId);
	} catch (error) {
		report(error);
	}
}

/**
 * @description Forgets every remembered bubble, after the appearance changes.
 */
export function forgetBubbles() {
	'worklet';
	holder()[STATE_KEY]?.cache.clear();
}

/**
 * @description Sets how a cell whose message was never measured is laid out until it is.
 * @param fallback The moves of a first row and whether its avatar hides, or `null` to leave such cells to Discord.
 */
export function setCellFallback(fallback: CellFallback | null) {
	'worklet';
	const current = holder()[STATE_KEY];

	if (current) current.fallback = fallback;
}

/**
 * @description Gives cells back Discord's own layout when the bubbles stop, including cells waiting for reuse that the screen does not show.
 * @param cells The message cells.
 */
export function restoreCells(cells: NativeObjectHandle[]) {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) return;

	// Nothing is drawn again before the scope's hooks go.
	current.fallback = null;
	current.cache.clear();
	current.cells.pictures.clear();
	current.cells.waiting.clear();

	for (const cell of cells) {
		try {
			resetCell(current.objc, cell);
		} catch (error) {
			report(error);
		}
	}
}

export default { installBubbleGuards, drawBubble, forgetBubbles, restoreCells, setCellFallback };
