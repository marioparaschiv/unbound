import type { NativeObjCBridge, NativeObjectHandle, NativeUIScope } from '@unbound-app/api/native';

import { greenRanges } from '~/lib/greentext';

const STATE_KEY = '__unboundGreentext';
const CODE_BLOCK_ATTRIBUTE = 'ContentNodeAttribute:DrawingDataLayers';
const FOREGROUND = 'NSColor';
const MAX_PAINTED = 256;

type Painted = {
	view: NativeObjectHandle;
	original: NativeObjectHandle;
	applied: NativeObjectHandle;
};

type State = {
	objc: NativeObjCBridge;
	color: NativeObjectHandle | null;
	painted: Map<string, Painted>;
	updating: boolean;
};

type Holder = Record<typeof STATE_KEY, State | undefined>;

type Attributes = Record<string, unknown>;

function holder(): Holder {
	'worklet';

	return globalThis as unknown as Holder;
}

function uiColor(objc: NativeObjCBridge, hex: string): NativeObjectHandle | null {
	'worklet';
	const UIColor = objc.getClass('UIColor');
	const value = Number.parseInt(hex.slice(1), 16);

	return UIColor
		? (objc.call(
				UIColor,
				'colorWithRed:green:blue:alpha:',
				((value >> 16) & 0xff) / 255,
				((value >> 8) & 0xff) / 255,
				(value & 0xff) / 255,
				1,
			) as NativeObjectHandle | null)
		: null;
}

function greened(state: State, original: NativeObjectHandle): NativeObjectHandle | null {
	'worklet';
	const { objc, color } = state;
	const text = objc.call(original, 'string');

	if (!color || typeof text !== 'string' || !text.includes('>')) {
		return null;
	}

	const ranges = greenRanges(text).filter(({ start }) => {
		const attributes = objc.call(
			original,
			'attributesAtIndex:effectiveRange:',
			start,
			null,
		) as Attributes | null;

		return !attributes?.[CODE_BLOCK_ATTRIBUTE];
	});

	if (!ranges.length) {
		return null;
	}

	const copy = objc.alloc('NSMutableAttributedString');

	if (!objc.call(copy, 'initWithAttributedString:', original)) {
		return null;
	}

	for (const { start, length } of ranges) {
		const range = objc.struct('NSRange', { location: start, length });

		objc.call(copy, 'addAttribute:value:range:', FOREGROUND, color, range);
	}

	return copy;
}

function remember(state: State, key: string, painted: Painted) {
	'worklet';
	state.painted.delete(key);
	state.painted.set(key, painted);

	if (state.painted.size > MAX_PAINTED) {
		state.painted.delete(state.painted.keys().next().value as string);
	}
}

function setText(state: State, view: NativeObjectHandle, text: NativeObjectHandle) {
	'worklet';
	state.updating = true;

	try {
		state.objc.invoke(view, 'setAttributedText:', [text]);
	} finally {
		state.updating = false;
	}
}

function paint(state: State, view: NativeObjectHandle) {
	'worklet';
	const { objc } = state;

	if (state.updating) {
		return;
	}

	const original = objc.invoke(view, 'attributedText', []) as NativeObjectHandle | null;
	const applied = original ? greened(state, original) : null;

	if (!original || !applied) {
		return;
	}

	setText(state, view, applied);
	remember(state, String(objc.call(view, 'hash')), { view, original, applied });
}

function stillShowing(state: State, entry: Painted): boolean {
	'worklet';
	const text = state.objc.invoke(entry.view, 'attributedText', []) as NativeObjectHandle | null;

	return Boolean(text && state.objc.call(text, 'isEqual:', entry.applied));
}

/**
 * @description Colors the lines of message text that start with `>`, from hooks on the UI thread that run in the same pass that sets the text.
 * @param scope The plugin's UI scope, which removes the hooks on dispose.
 * @param textClasses The message text view classes this Discord build may use.
 * @param hex The color, as `#rrggbb`.
 */
export function installGreentext(scope: NativeUIScope, textClasses: string[], hex: string) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;
	const state: State = { objc, color: uiColor(objc, hex), painted: new Map(), updating: false };

	holder()[STATE_KEY] = state;

	for (const className of textClasses) {
		if (!objc.getClass(className)) {
			continue;
		}

		objc.hook(className, 'setAttributedText:', {
			after: ({ self }) => {
				try {
					paint(state, self);
				} catch (error) {
					console.error(`[Greentext] Failed to color a message: ${String(error)}`);
				}
			},
		});
	}
}

/**
 * @description Changes the color and recolors the messages already on screen.
 * @param hex The new color, as `#rrggbb`.
 */
export function setGreentextColor(hex: string) {
	'worklet';
	const state = holder()[STATE_KEY];

	if (!state) {
		return;
	}

	state.color = uiColor(state.objc, hex);

	for (const [key, entry] of [...state.painted]) {
		if (!stillShowing(state, entry)) {
			state.painted.delete(key);
			continue;
		}

		const applied = greened(state, entry.original);

		if (applied) {
			setText(state, entry.view, applied);
			entry.applied = applied;
		}
	}
}

/**
 * @description Puts back the message text it colored, where Discord has not replaced it since.
 */
export function restoreGreentext() {
	'worklet';
	const state = holder()[STATE_KEY];

	if (!state) {
		return;
	}

	for (const entry of state.painted.values()) {
		try {
			if (stillShowing(state, entry)) {
				setText(state, entry.view, entry.original);
			}
		} catch (error) {
			console.error(`[Greentext] Failed to restore a message: ${String(error)}`);
		}
	}

	holder()[STATE_KEY] = undefined;
}

export default { installGreentext, setGreentextColor, restoreGreentext };
