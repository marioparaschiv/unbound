import type { NativeObjCBridge, NativeObjectHandle, NativeUIScope } from '@unbound-app/api/native';

import type { ColorRun } from '~/ios/ui-chat-input';

const STATE_KEY = '__unboundRoleColorMessages';
const CELL_CLASS = 'DCDMessageTableViewCell';
const MENTION_BOUNDARY = /[\s⁨⁩]/u;
const MAX_CELL_DEPTH = 12;
const MAX_COLORS = 256;
const MAX_PAINTED = 256;

export type MessageMentions = {
	names: string[];
	runs: Record<string, ColorRun[]>;
};

export type ChannelMentions = Record<string, MessageMentions>;

type Painted = {
	view: NativeObjectHandle;
	original: NativeObjectHandle;
	applied: NativeObjectHandle;
};

type MessageState = {
	objc: NativeObjCBridge;
	messages: ChannelMentions;
	colors: Map<string, NativeObjectHandle>;
	painted: Map<string, Painted>;
	updating: boolean;
};

type StateHolder = Record<typeof STATE_KEY, MessageState | undefined>;

type TextAttributes = {
	YYTextHighlight?: unknown;
};

function holder(): StateHolder {
	'worklet';

	return globalThis as unknown as StateHolder;
}

function uiColor(current: MessageState, hex: string): NativeObjectHandle | null {
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

function owningCell(objc: NativeObjCBridge, view: NativeObjectHandle): NativeObjectHandle | null {
	'worklet';
	const cellClass = objc.getClass(CELL_CLASS);
	let current: NativeObjectHandle | null = view;

	for (let depth = 0; current && cellClass && depth < MAX_CELL_DEPTH; depth++) {
		if (objc.call(current, 'isKindOfClass:', cellClass)) {
			return current;
		}

		current = objc.invoke(current, 'superview', []) as NativeObjectHandle | null;
	}

	return null;
}

function messageIdOf(objc: NativeObjCBridge, cell: NativeObjectHandle): string | undefined {
	'worklet';
	const viewModel = objc.getIvar(cell, 'viewModel') as NativeObjectHandle | null;
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

function remember(current: MessageState, key: string, painted: Painted) {
	'worklet';
	current.painted.delete(key);
	current.painted.set(key, painted);

	if (current.painted.size > MAX_PAINTED) {
		current.painted.delete(current.painted.keys().next().value as string);
	}
}

function paint(current: MessageState, view: NativeObjectHandle) {
	'worklet';
	const { objc } = current;

	if (current.updating) {
		return;
	}

	const cell = owningCell(objc, view);
	const messageId = cell ? messageIdOf(objc, cell) : undefined;
	const mentions = messageId ? current.messages[messageId] : undefined;

	if (!mentions) {
		return;
	}

	const original = objc.invoke(view, 'attributedText', []) as NativeObjectHandle | null;
	const text = original ? objc.call(original, 'string') : null;

	if (!original || typeof text !== 'string' || !text.includes('@')) {
		return;
	}

	const painted = objc.alloc('NSMutableAttributedString');

	if (!objc.call(painted, 'initWithAttributedString:', original)) {
		return;
	}

	let changed = false;

	for (let at = text.indexOf('@'); at >= 0; at = text.indexOf('@', at + 1)) {
		const name = matchMention(text, at, mentions.names);
		const runs = name ? mentions.runs[name] : undefined;

		if (!name || !runs) {
			continue;
		}

		const attributes = objc.call(
			original,
			'attributesAtIndex:effectiveRange:',
			at,
			null,
		) as TextAttributes | null;

		if (!attributes?.YYTextHighlight) {
			continue;
		}

		let position = at;

		for (const run of runs) {
			const color = uiColor(current, run.color);

			if (color) {
				const range = objc.struct('NSRange', { location: position, length: run.length });

				objc.call(painted, 'addAttribute:value:range:', 'NSColor', color, range);
			}

			position += run.length;
		}

		at += name.length;
		changed = true;
	}

	if (!changed) {
		return;
	}

	current.updating = true;

	try {
		objc.invoke(view, 'setAttributedText:', [painted]);
	} finally {
		current.updating = false;
	}

	remember(current, String(objc.call(view, 'hash')), { view, original, applied: painted });
}

/**
 * @description Paints mentions in native message text with role colors from hooks that run on the UI thread, in the same pass that sets the text, so a mention never shows uncolored.
 * @param scope The plugin's UI scope.
 * @param textClasses The message text view classes this Discord build may use.
 * @param messages The colored mentions per loaded message.
 */
export function installMessageMentionHooks(
	scope: NativeUIScope,
	textClasses: string[],
	messages: ChannelMentions,
) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;
	const current: MessageState = {
		objc,
		messages,
		colors: new Map(),
		painted: new Map(),
		updating: false,
	};

	holder()[STATE_KEY] = current;

	for (const className of textClasses) {
		if (!objc.getClass(className)) {
			continue;
		}

		objc.hook(className, 'setAttributedText:', {
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
 * @description Replaces the colored mentions, after messages load or change.
 * @param messages The colored mentions per loaded message.
 */
export function setMessageMentions(messages: ChannelMentions) {
	'worklet';
	const current = holder()[STATE_KEY];

	if (current) {
		current.messages = messages;
	}
}

/**
 * @description Puts back the message text it painted, when Discord has not replaced it since.
 */
export function restoreMessageMentions() {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) {
		return;
	}

	const { objc } = current;

	current.updating = true;

	current.painted.forEach((entry) => {
		try {
			const text = objc.invoke(entry.view, 'attributedText', []) as NativeObjectHandle | null;

			if (text && objc.call(text, 'isEqual:', entry.applied)) {
				objc.invoke(entry.view, 'setAttributedText:', [entry.original]);
			}
		} catch (error) {
			console.error(`[Role Color Everywhere] ${String(error)}`);
		}
	});

	holder()[STATE_KEY] = undefined;
}

export default { installMessageMentionHooks, setMessageMentions, restoreMessageMentions };
