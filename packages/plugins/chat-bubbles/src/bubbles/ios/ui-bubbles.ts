import type {
	NativeObjCBridge,
	NativeObjectHandle,
	NativeUICallback,
	NativeUIScope,
} from '@unbound-app/api/native';

import type { BubbleColor } from '~/bubbles/style';

const STATE_KEY = '__unboundChatBubbles';
const MAX_CACHED = 400;
const WIDTH_TOLERANCE = 1;

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
	color: BubbleColor;
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

function messageIdOfViewModel(
	objc: NativeObjCBridge,
	viewModel: NativeObjectHandle | null,
): string | undefined {
	'worklet';
	const message = viewModel
		? (objc.call(viewModel, 'message') as NativeObjectHandle | null)
		: null;
	const identifier = message ? objc.call(message, 'id') : null;

	if (typeof identifier === 'string') {
		return identifier;
	}

	if (identifier && typeof identifier === 'object') {
		const description = objc.call(identifier as NativeObjectHandle, 'description');

		return typeof description === 'string' ? description : undefined;
	}

	return undefined;
}

function messageIdOf(objc: NativeObjCBridge, cell: NativeObjectHandle): string | undefined {
	'worklet';

	return messageIdOfViewModel(objc, objc.getIvar(cell, 'viewModel') as NativeObjectHandle | null);
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
	objc.invoke(objc.invoke(bubble, 'layer', []) as NativeObjectHandle, 'setMasksToBounds:', [
		true,
	]);
	objc.invoke(bubble, 'setUserInteractionEnabled:', [false]);
	objc.invoke(cell, 'insertSubview:atIndex:', [bubble, 0]);

	return bubble;
}

function paintBubble(objc: NativeObjCBridge, bubble: NativeObjectHandle, drawn: CachedBubble) {
	'worklet';
	const UIColor = objc.getClass('UIColor');

	if (!UIColor) {
		return;
	}

	const { red, green, blue, alpha } = drawn.color;

	objc.invoke(objc.invoke(bubble, 'layer', []) as NativeObjectHandle, 'setCornerRadius:', [
		drawn.radius,
	]);
	objc.invoke(bubble, 'setBackgroundColor:', [
		objc.call(UIColor, 'colorWithRed:green:blue:alpha:', red, green, blue, alpha),
	]);
	objc.invoke(bubble, 'setFrame:', [
		objc.struct('CGRect', {
			origin: { x: drawn.x, y: drawn.y },
			size: { width: drawn.width, height: drawn.height },
		}),
	]);
	objc.invoke(bubble, 'setHidden:', [false]);
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
		return;
	}

	const bubble = bubbleIn(objc, cell, tag);

	if (bubble) {
		paintBubble(objc, bubble, cached);
	}
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
	const current: BubbleState = { cache: new Map(), objc, clear, remeasure };

	holder()[STATE_KEY] = current;

	if (!clear) {
		return;
	}

	function keepClear({ self, args }: ColorEvent) {
		const color = args[0] as NativeObjectHandle | null;

		try {
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
			} catch (error) {
				report(error);
			}
		},
	});
	objc.hook(classes.messageCell, 'layoutSubviews', {
		after: ({ self }) => {
			try {
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
 * @param drawn The bubble's frame in its cell, the cell's width, the corner radius and the color.
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

		paintBubble(objc, bubble, drawn);

		if (messageId) {
			remember(current, messageId, drawn);
		}
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

export default { installBubbleGuards, drawBubble, forgetBubbles };
