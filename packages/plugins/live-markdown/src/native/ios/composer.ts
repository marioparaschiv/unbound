import type { NativeObjCBridge, NativeObjectHandle, NativeUIScope } from '@unbound-app/api/native';

import { markdownRuns, type MarkdownRun, type MarkdownStyle } from '~/lib/markdown';
import { reportWorkletError } from '@unbound-plugins/shared/native/report-worklet-error';

const STATE_KEY = '__unboundLiveMarkdown';
const COMPOSER_CLASS = 'DCDChatInputComponentView';
const SELECTORS = ['textViewDidChange:', 'setText:', 'setAttributedText:', 'didMoveToWindow'];
const BOLD = 2;
const ITALIC = 1;
const HEADING_SCALE: Partial<Record<MarkdownStyle, number>> = {
	heading1: 1.45,
	heading2: 1.3,
	heading3: 1.15,
	subtext: 0.85,
};

type Painted = { view: NativeObjectHandle; runs: MarkdownRun[]; key: string };

type ComposerState = {
	objc: NativeObjCBridge;
	painted: Map<string, Painted>;
	fonts: Map<string, NativeObjectHandle>;
	updating: boolean;
};

type StateHolder = Record<typeof STATE_KEY, ComposerState | undefined>;

function holder(): StateHolder {
	'worklet';

	return globalThis as unknown as StateHolder;
}

function range(objc: NativeObjCBridge, location: number, length: number) {
	'worklet';

	return objc.struct('NSRange', { location, length });
}

function fontFor(
	current: ComposerState,
	base: NativeObjectHandle,
	style: MarkdownStyle,
): NativeObjectHandle | null {
	'worklet';
	const { objc } = current;
	const size = Number(objc.call(base, 'pointSize')) || 16;
	const name = objc.call(base, 'fontName');
	const cacheKey = `${typeof name === 'string' ? name : ''}:${size}:${style}`;
	const cached = current.fonts.get(cacheKey);

	if (cached) return cached;

	const UIFont = objc.getClass('UIFont');

	if (!UIFont) return null;

	let font: NativeObjectHandle | null = null;

	if (style === 'code') {
		font = objc.call(
			UIFont,
			'monospacedSystemFontOfSize:weight:',
			size * 0.9,
			0,
		) as NativeObjectHandle | null;
	} else {
		const traits =
			style === 'italic' ? ITALIC : style === 'subtext' || style === 'quote' ? 0 : BOLD;
		const descriptor = objc.call(base, 'fontDescriptor') as NativeObjectHandle;
		const styled = traits
			? (objc.call(
					descriptor,
					'fontDescriptorWithSymbolicTraits:',
					traits,
				) as NativeObjectHandle | null)
			: descriptor;

		font = objc.call(
			UIFont,
			'fontWithDescriptor:size:',
			styled ?? descriptor,
			size * (HEADING_SCALE[style] ?? 1),
		) as NativeObjectHandle | null;
	}

	if (font) current.fonts.set(cacheKey, font);

	return font;
}

function faded(
	objc: NativeObjCBridge,
	color: NativeObjectHandle,
	alpha: number,
): NativeObjectHandle {
	'worklet';

	return objc.call(color, 'colorWithAlphaComponent:', alpha) as NativeObjectHandle;
}

function tint(objc: NativeObjCBridge, white: number, alpha: number): NativeObjectHandle | null {
	'worklet';
	const UIColor = objc.getClass('UIColor');

	return UIColor
		? (objc.call(UIColor, 'colorWithWhite:alpha:', white, alpha) as NativeObjectHandle | null)
		: null;
}

function reset(
	objc: NativeObjCBridge,
	storage: NativeObjectHandle,
	runs: MarkdownRun[],
	length: number,
	font: NativeObjectHandle,
	color: NativeObjectHandle,
) {
	'worklet';

	for (const run of runs) {
		const start = Math.min(run.start, length);
		const end = Math.min(run.start + run.length, length);

		if (end <= start) continue;

		const at = range(objc, start, end - start);

		objc.call(storage, 'addAttribute:value:range:', 'NSFont', font, at);
		objc.call(storage, 'addAttribute:value:range:', 'NSColor', color, at);
		objc.call(storage, 'removeAttribute:range:', 'NSStrikethrough', at);
		objc.call(storage, 'removeAttribute:range:', 'NSUnderline', at);
		objc.call(storage, 'removeAttribute:range:', 'NSBackgroundColor', at);
	}
}

function apply(
	current: ComposerState,
	storage: NativeObjectHandle,
	run: MarkdownRun,
	font: NativeObjectHandle,
	color: NativeObjectHandle,
) {
	'worklet';
	const { objc } = current;
	const at = range(objc, run.start, run.length);
	const set = (key: string, value: unknown) =>
		objc.call(storage, 'addAttribute:value:range:', key, value, at);

	switch (run.style) {
		case 'marker':
			set('NSColor', faded(objc, color, 0.4));
			return;
		case 'strike':
			set('NSStrikethrough', 1);
			return;
		case 'underline':
			set('NSUnderline', 1);
			return;
		case 'spoiler':
			set('NSBackgroundColor', tint(objc, 0, 0.35));
			return;
		case 'quote':
			set('NSColor', faded(objc, color, 0.75));
			return;
		case 'code':
			set('NSBackgroundColor', tint(objc, 0.5, 0.2));
			break;
		case 'subtext':
			set('NSColor', faded(objc, color, 0.65));
			break;
	}

	const styled = fontFor(current, font, run.style);

	if (styled) set('NSFont', styled);
}

function paint(current: ComposerState, view: NativeObjectHandle) {
	'worklet';
	const { objc } = current;

	if (current.updating || !objc.invoke(view, 'window', [])) return;

	const storage = objc.call(view, 'textStorage') as NativeObjectHandle | null;
	const font = objc.call(view, 'font') as NativeObjectHandle | null;
	const color = objc.call(view, 'textColor') as NativeObjectHandle | null;
	const text = storage ? objc.call(storage, 'string') : null;

	if (!storage || !font || !color || typeof text !== 'string') return;

	const id = `${Number(objc.call(view, 'hash'))}`;
	const runs = markdownRuns(text);
	const key = `${text}\u0000${runs.length}`;
	const previous = current.painted.get(id);

	if (previous?.key === key) return;

	current.updating = true;

	try {
		objc.call(storage, 'beginEditing');
		reset(objc, storage, previous?.runs ?? [], text.length, font, color);

		for (const run of runs) apply(current, storage, run, font, color);

		objc.call(storage, 'endEditing');
		objc.call(view, 'setTypingAttributes:', { NSFont: font, NSColor: color });
	} finally {
		current.updating = false;
	}

	current.painted.set(id, { view, runs, key });
}

/**
 * @description Draws the markdown in Discord's native composer as it is typed, from hooks that run on the UI thread after
 * each text change, by restyling the text storage in place so the cursor and Discord's own spans stay where they are.
 * @param scope The plugin's UI scope.
 */
export function installComposerMarkdown(scope: NativeUIScope) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;
	const current: ComposerState = { objc, painted: new Map(), fonts: new Map(), updating: false };

	holder()[STATE_KEY] = current;

	for (const selector of SELECTORS) {
		objc.hook(COMPOSER_CLASS, selector, {
			after: ({ self }) => {
				try {
					paint(current, self);
				} catch (error) {
					reportWorkletError('Live Markdown', error);
				}
			},
		});
	}
}

/**
 * @description Puts the composer text back to plain styling.
 */
export function restoreComposerMarkdown() {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) return;

	const { objc } = current;

	current.updating = true;

	for (const entry of current.painted.values()) {
		try {
			const storage = objc.call(entry.view, 'textStorage') as NativeObjectHandle | null;
			const font = objc.call(entry.view, 'font') as NativeObjectHandle | null;
			const color = objc.call(entry.view, 'textColor') as NativeObjectHandle | null;
			const text = storage ? objc.call(storage, 'string') : null;

			if (storage && font && color && typeof text === 'string') {
				objc.call(storage, 'beginEditing');
				reset(objc, storage, entry.runs, text.length, font, color);
				objc.call(storage, 'endEditing');
			}
		} catch (error) {
			reportWorkletError('Live Markdown', error);
		}
	}

	holder()[STATE_KEY] = undefined;
}
