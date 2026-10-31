import type { NativeObjCBridge, NativeObjectHandle, NativeUIScope } from '@unbound-app/api/native';

const STATE_KEY = '__unboundRoleColorComposer';
const COMPOSER_CLASS = 'DCDChatInputComponentView';
const SELECTORS = [
	'setAttributedText:',
	'setText:',
	'textViewDidChange:',
	'layoutSubviews',
	'didMoveToWindow',
];
const MENTION_BOUNDARY = /[\s,.!?;:]/u;
const MAX_COLORS = 256;

export type ColorRun = {
	length: number;
	color: string;
};

export type ComposerMentions = {
	names: string[];
	runs: Record<string, ColorRun[]>;
};

type Painted = {
	view: NativeObjectHandle;
	original: NativeObjectHandle;
	applied: NativeObjectHandle;
};

type ComposerState = {
	objc: NativeObjCBridge;
	mentions: ComposerMentions;
	colors: Map<string, NativeObjectHandle>;
	painted: Map<string, Painted>;
	updating: boolean;
};

type StateHolder = Record<typeof STATE_KEY, ComposerState | undefined>;

type TextAttributes = {
	NSFont?: NativeObjectHandle;
};

function holder(): StateHolder {
	'worklet';

	return globalThis as unknown as StateHolder;
}

function uiColor(current: ComposerState, hex: string): NativeObjectHandle | null {
	'worklet';
	const cached = current.colors.get(hex);

	if (cached) {
		return cached;
	}

	const UIColor = current.objc.getClass('UIColor');

	if (!UIColor) {
		return null;
	}

	const value = Number.parseInt(hex.slice(1), 16);
	const color = current.objc.call(
		UIColor,
		'colorWithRed:green:blue:alpha:',
		((value >> 16) & 0xff) / 255,
		((value >> 8) & 0xff) / 255,
		(value & 0xff) / 255,
		1,
	) as NativeObjectHandle | null;

	if (current.colors.size >= MAX_COLORS) {
		current.colors.clear();
	}

	if (color) {
		current.colors.set(hex, color);
	}

	return color;
}

function matchMention(text: string, at: number, names: string[]): string | undefined {
	'worklet';

	return names.find((name) => {
		if (!text.startsWith(`@${name}`, at)) {
			return false;
		}

		const next = text[at + name.length + 1];

		return !next || MENTION_BOUNDARY.test(next);
	});
}

function isCompletedMention(
	objc: NativeObjCBridge,
	original: NativeObjectHandle,
	at: number,
): boolean {
	'worklet';
	const attributes = objc.call(
		original,
		'attributesAtIndex:effectiveRange:',
		at,
		null,
	) as TextAttributes | null;
	const fontName = attributes?.NSFont ? objc.call(attributes.NSFont, 'fontName') : null;

	return typeof fontName === 'string' && /bold|semibold/i.test(fontName);
}

function paintRuns(
	current: ComposerState,
	painted: NativeObjectHandle,
	runs: ColorRun[],
	location: number,
) {
	'worklet';
	let position = location;

	for (const run of runs) {
		const color = uiColor(current, run.color);

		if (color) {
			const range = current.objc.struct('NSRange', {
				location: position,
				length: run.length,
			});

			current.objc.call(painted, 'addAttribute:value:range:', 'NSColor', color, range);
		}

		position += run.length;
	}
}

function paint(current: ComposerState, view: NativeObjectHandle) {
	'worklet';
	const { objc, mentions } = current;

	if (current.updating || !mentions.names.length || !objc.invoke(view, 'window', [])) {
		return;
	}

	const original = objc.invoke(view, 'attributedText', []) as NativeObjectHandle | null;

	if (!original) {
		return;
	}

	const key = String(objc.call(view, 'hash'));
	const previous = current.painted.get(key);

	if (previous && objc.call(original, 'isEqual:', previous.applied)) {
		return;
	}

	const text = objc.call(original, 'string');

	if (typeof text !== 'string' || !text.includes('@')) {
		return;
	}

	const painted = objc.alloc('NSMutableAttributedString');

	if (!objc.call(painted, 'initWithAttributedString:', original)) {
		return;
	}

	let changed = false;

	for (let at = text.indexOf('@'); at >= 0; at = text.indexOf('@', at + 1)) {
		if (!isCompletedMention(objc, original, at)) {
			continue;
		}

		const name = matchMention(text, at, mentions.names);
		const runs = name ? mentions.runs[name] : undefined;

		if (!name || !runs) {
			continue;
		}

		paintRuns(current, painted, runs, at);
		at += name.length;
		changed = true;
	}

	if (!changed) {
		return;
	}

	const selection = objc.invoke(view, 'selectedRange', []);

	current.updating = true;

	try {
		objc.invoke(view, 'setAttributedText:', [painted]);

		if (selection) {
			objc.invoke(view, 'setSelectedRange:', [selection]);
		}
	} finally {
		current.updating = false;
	}

	current.painted.set(key, { view, original, applied: painted });
}

/**
 * @description Paints completed mentions in the native composer with role colors from hooks that run on the UI thread, in the same pass that sets the text, so a mention never shows uncolored.
 * @param scope The plugin's UI scope.
 * @param mentions The names to color, longest first, with their color runs.
 */
export function installComposerHooks(scope: NativeUIScope, mentions: ComposerMentions) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;
	const current: ComposerState = {
		objc,
		mentions,
		colors: new Map(),
		painted: new Map(),
		updating: false,
	};

	holder()[STATE_KEY] = current;

	for (const selector of SELECTORS) {
		objc.hook(COMPOSER_CLASS, selector, {
			after: ({ self }) => {
				try {
					paint(current, self);
				} catch (error) {
					console.error(`[Role Color Everywhere] ${String(error)}`);
				}
			},
		});
	}
}

/**
 * @description Replaces the names the composer colors, after the channel or its members change.
 * @param mentions The names to color, longest first, with their color runs.
 */
export function setComposerMentions(mentions: ComposerMentions) {
	'worklet';
	const current = holder()[STATE_KEY];

	if (current) {
		current.mentions = mentions;
	}
}

/**
 * @description Puts back the composer text it painted, when the user has not changed it since.
 */
export function restoreComposer() {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) {
		return;
	}

	const { objc } = current;

	current.updating = true;

	for (const entry of current.painted.values()) {
		try {
			const text = objc.invoke(entry.view, 'attributedText', []);

			if (objc.call(text as NativeObjectHandle, 'isEqual:', entry.applied)) {
				const selection = objc.invoke(entry.view, 'selectedRange', []);

				objc.invoke(entry.view, 'setAttributedText:', [entry.original]);

				if (selection) {
					objc.invoke(entry.view, 'setSelectedRange:', [selection]);
				}
			}
		} catch (error) {
			console.error(`[Role Color Everywhere] ${String(error)}`);
		}
	}

	holder()[STATE_KEY] = undefined;
}

export default { installComposerHooks, setComposerMentions, restoreComposer };
