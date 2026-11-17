import type { NativeObjCBridge, NativeObjectHandle, NativeUIScope } from '@unbound-app/api/native';

import { scriptRuns, type ScriptId } from '~/lib/scripts';

const STATE_KEY = '__unboundFontFallback';
const CODE_BLOCK_ATTRIBUTE = 'ContentNodeAttribute:DrawingDataLayers';
const FONT = 'NSFont';
const DEFAULT_SIZE = 16;
const MAX_PAINTED = 256;

/** Each script's registered font, by PostScript name. */
export type ScriptFonts = Partial<Record<ScriptId, string>>;

type Painted = {
	view: NativeObjectHandle;
	original: NativeObjectHandle;
	applied: NativeObjectHandle;
};

type State = {
	objc: NativeObjCBridge;
	fonts: ScriptFonts;
	painted: Map<string, Painted>;
	updating: boolean;
};

type Holder = Record<typeof STATE_KEY, State | undefined>;

type Attributes = Record<string, unknown>;

function holder(): Holder {
	'worklet';

	return globalThis as unknown as Holder;
}

function sizeAt(objc: NativeObjCBridge, text: NativeObjectHandle, index: number): number {
	'worklet';
	const font = objc.call(
		text,
		'attribute:atIndex:effectiveRange:',
		FONT,
		index,
		null,
	) as NativeObjectHandle | null;
	const size = font ? Number(objc.call(font, 'pointSize')) : NaN;

	return Number.isFinite(size) && size > 0 ? size : DEFAULT_SIZE;
}

function inCodeBlock(objc: NativeObjCBridge, text: NativeObjectHandle, index: number): boolean {
	'worklet';
	const attributes = objc.call(
		text,
		'attributesAtIndex:effectiveRange:',
		index,
		null,
	) as Attributes | null;

	return Boolean(attributes?.[CODE_BLOCK_ATTRIBUTE]);
}

function refonted(state: State, original: NativeObjectHandle): NativeObjectHandle | null {
	'worklet';
	const { objc, fonts } = state;
	const text = objc.call(original, 'string');
	const wanted = new Set(Object.keys(fonts) as ScriptId[]);
	const runs =
		typeof text === 'string' && wanted.size
			? scriptRuns(text, wanted).filter(({ start }) => !inCodeBlock(objc, original, start))
			: [];

	if (!runs.length) return null;

	const UIFont = objc.getClass('UIFont');
	const copy = objc.alloc('NSMutableAttributedString');

	if (!UIFont || !objc.call(copy, 'initWithAttributedString:', original)) return null;

	for (const { script, start, length } of runs) {
		const font = objc.call(
			UIFont,
			'fontWithName:size:',
			fonts[script]!,
			sizeAt(objc, original, start),
		);

		if (font) {
			objc.call(
				copy,
				'addAttribute:value:range:',
				FONT,
				font,
				objc.struct('NSRange', { location: start, length }),
			);
		}
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
	if (state.updating) return;

	const original = state.objc.invoke(view, 'attributedText', []) as NativeObjectHandle | null;
	const applied = original ? refonted(state, original) : null;

	if (!original || !applied) return;

	setText(state, view, applied);
	remember(state, String(state.objc.call(view, 'hash')), { view, original, applied });
}

function stillShowing(state: State, entry: Painted): boolean {
	'worklet';
	const text = state.objc.invoke(entry.view, 'attributedText', []) as NativeObjectHandle | null;

	return Boolean(text && state.objc.call(text, 'isEqual:', entry.applied));
}

/**
 * @description Draws each script's runs in message text with its font, from hooks on the UI thread that run in the
 * same pass that sets the text.
 * @param scope The plugin's UI scope, which removes the hooks on dispose.
 * @param textClasses The message text view classes this Discord build may use.
 * @param fonts Each script's registered font.
 */
export function installFontFallback(
	scope: NativeUIScope,
	textClasses: string[],
	fonts: ScriptFonts,
) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;
	const state: State = { objc, fonts, painted: new Map(), updating: false };

	holder()[STATE_KEY] = state;

	for (const className of textClasses) {
		if (!objc.getClass(className)) continue;

		objc.hook(className, 'setAttributedText:', {
			after: ({ self }) => {
				try {
					paint(state, self);
				} catch (error) {
					console.error(
						`[Font Fallback] Failed to set a message's fonts: ${String(error)}`,
					);
				}
			},
		});
	}
}

/**
 * @description Changes the fonts and redraws the messages already on screen.
 * @param fonts Each script's registered font.
 */
export function setFontFallback(fonts: ScriptFonts) {
	'worklet';
	const state = holder()[STATE_KEY];

	if (!state) return;

	state.fonts = fonts;

	for (const [key, entry] of [...state.painted]) {
		if (!stillShowing(state, entry)) {
			state.painted.delete(key);
			continue;
		}

		const applied = refonted(state, entry.original) ?? entry.original;

		setText(state, entry.view, applied);
		entry.applied = applied;
	}
}

/**
 * @description Puts back the message text it changed, where Discord has not replaced it since.
 */
export function restoreFontFallback() {
	'worklet';
	const state = holder()[STATE_KEY];

	if (!state) return;

	for (const entry of state.painted.values()) {
		try {
			if (stillShowing(state, entry)) setText(state, entry.view, entry.original);
		} catch (error) {
			console.error(`[Font Fallback] Failed to restore a message: ${String(error)}`);
		}
	}

	holder()[STATE_KEY] = undefined;
}
