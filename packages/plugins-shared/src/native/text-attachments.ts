import type { NativeHandle, NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';

import { safeInvoke } from './safe-invoke';
import { readRect } from './rect';

export type TextEngine = 'textkit' | 'yytext';

export type TextStructFields = Parameters<NativeObjCBridge['struct']>[1];

export const ATTACHMENT_CHARACTER = '￼';

export const MESSAGE_TEXT_VIEW_CLASSES = ['DCDAttributedTextView', 'DCDReusableYYLabel'] as const;

/**
 * @description Picks the message text view class this Discord build draws message text with.
 * @param objc The Objective-C bridge.
 * @returns The first class from `MESSAGE_TEXT_VIEW_CLASSES` that exists, or the newest one when none does.
 */
export function messageTextViewClass(objc: Pick<NativeObjCBridge, 'getClass'>): string {
	return (
		MESSAGE_TEXT_VIEW_CLASSES.find((name) => objc.getClass(name)) ??
		MESSAGE_TEXT_VIEW_CLASSES[0]
	);
}

export const CODE_BLOCK_ATTRIBUTE = 'ContentNodeAttribute:DrawingDataLayers';

export type TextAttachmentValue =
	| NativeHandle
	| number
	| string
	| boolean
	| bigint
	| null
	| undefined;

export type TextAttributeValue = NativeHandle | number | string | boolean | null | undefined;

export type TextAttributes = Record<string, TextAttributeValue>;

export type TextAttachmentArgument = TextAttachmentValue | TextAttributes;

export type TextAttachmentBridge = {
	call(
		target: NativeObjectHandle,
		selector: string,
		...args: TextAttachmentArgument[]
	): TextAttachmentValue;
	getClass(name: string): NativeObjectHandle | null;
	alloc(classOrName: string | NativeObjectHandle): NativeObjectHandle;
	struct(name: string, value: TextStructFields): NativeObjectHandle;
	callAsync(
		target: NativeObjectHandle,
		selector: string,
		...args: TextAttachmentArgument[]
	): Promise<TextAttachmentValue>;
};

export type ViewAttachmentOptions = {
	attributes: TextAttributes;
	view: NativeObjectHandle;
	width: number;
	height: number;
};

export type AttachedView = {
	view: NativeObjectHandle;
	index: number;
};

export type TextRange = {
	start: number;
	end: number;
};

export type ImageAttachmentOptions = {
	attributes: TextAttributes;
	image: NativeObjectHandle;
	size: number;
	leading?: number;
	trailing?: number;
};

const INVISIBLE_FORMATTING = new Set(['​', '⁠', '⁨', '⁩', '﻿']);
const TAPPABLE_KEYS = ['YYTextHighlight', 'ContentNodeAttribute:TappableHighlight'];
const ATTACHMENT_KEYS = ['YYTextAttachment', 'NSAttachment'];
const VALUE_TYPES = new Set(['bigint', 'boolean', 'number', 'object', 'string', 'undefined']);

function isTextAttachmentValue(value: unknown): value is TextAttachmentValue {
	return value === null || VALUE_TYPES.has(typeof value);
}

/**
 * @description Wraps a plugin's Objective-C bridge for building attachments, returning `null` instead of throwing.
 * @param objc The plugin's Objective-C bridge.
 * @returns The attachment bridge.
 */
export function textAttachmentBridge(objc: NativeObjCBridge): TextAttachmentBridge {
	return {
		call(target, selector, ...args) {
			const result = safeInvoke(objc, target, selector, ...args);

			return isTextAttachmentValue(result) ? result : null;
		},
		getClass: (name) => objc.getClass(name),
		alloc: (classOrName) => objc.alloc(classOrName),
		struct: (name, value) => objc.struct(name, value),
		async callAsync(target, selector, ...args) {
			try {
				const result = await objc.invokeAsync(target, selector, args);

				return isTextAttachmentValue(result) ? result : null;
			} catch {
				return null;
			}
		},
	};
}

/**
 * @description Tells which layout engine a message text view uses.
 * @param bridge The attachment bridge.
 * @param view The message text view.
 * @returns `textkit` for Discord's `UITextView` based view, otherwise `yytext`.
 */
export function textEngine(bridge: TextAttachmentBridge, view: NativeObjectHandle): TextEngine {
	const textView = bridge.getClass('UITextView');

	if (textView && bridge.call(view, 'isKindOfClass:', textView) === true) {
		return 'textkit';
	}

	return 'yytext';
}

/**
 * @description Tells whether a character ends a run, counting Discord's invisible formatting characters.
 * @param character The character after the run, or `undefined` at the end of the text.
 * @returns Whether the run ends there.
 */
export function isTextBoundary(character: string | undefined): boolean {
	return !character || INVISIBLE_FORMATTING.has(character) || /\s/u.test(character);
}

function hasAny(attributes: TextAttributes | null | undefined, keys: string[]): boolean {
	if (!attributes || typeof attributes !== 'object') {
		return false;
	}

	return keys.some((key) => Boolean(attributes[key]));
}

/**
 * @description Tells whether a run is something Discord made tappable, such as a mention or a link.
 * @template T The attributes' shape.
 * @param attributes The run's attributes.
 * @returns Whether either engine marked the run tappable.
 */
export function isTappableRun<T extends TextAttributes>(
	attributes: T | null | undefined,
): attributes is T {
	return hasAny(attributes, TAPPABLE_KEYS);
}

/**
 * @description Tells whether a run is an attachment, such as an image a previous pass inserted.
 * @template T The attributes' shape.
 * @param attributes The run's attributes.
 * @returns Whether either engine marked the run as an attachment.
 */
export function isAttachmentRun<T extends TextAttributes>(
	attributes: T | null | undefined,
): attributes is T {
	return hasAny(attributes, ATTACHMENT_KEYS);
}

function numeric(value: TextAttachmentValue): number {
	if (typeof value === 'bigint') {
		return Number(value);
	}

	return typeof value === 'number' ? value : Number(value) || 0;
}

function fontOf(attributes: TextAttributes): NativeObjectHandle | undefined {
	const font = attributes.NSFont;

	return font !== null && typeof font === 'object' ? font : undefined;
}

function range(bridge: TextAttachmentBridge, location: number, length: number) {
	return bridge.struct('NSRange', { location, length });
}

function textKitImage(
	bridge: TextAttachmentBridge,
	options: ImageAttachmentOptions,
): NativeObjectHandle | null {
	if (!bridge.getClass('NSTextAttachment')) {
		return null;
	}

	const { attributes, image, size, trailing = 0 } = options;
	const font = fontOf(attributes);
	const capHeight = font ? numeric(bridge.call(font, 'capHeight')) : 0;
	const attachment = bridge.alloc('NSTextAttachment');

	bridge.call(attachment, 'init');
	bridge.call(attachment, 'setImage:', image);
	bridge.call(
		attachment,
		'setBounds:',
		bridge.struct('CGRect', {
			origin: { x: 0, y: (capHeight - size) / 2 },
			size: { width: size, height: size },
		}),
	);

	const result = bridge.alloc('NSMutableAttributedString');

	bridge.call(result, 'initWithString:attributes:', ATTACHMENT_CHARACTER, attributes);
	bridge.call(
		result,
		'addAttribute:value:range:',
		'NSAttachment',
		attachment,
		range(bridge, 0, 1),
	);

	if (trailing > 0) {
		bridge.call(result, 'addAttribute:value:range:', 'NSKern', trailing, range(bridge, 0, 1));
	}

	return result;
}

function yyTextImage(
	bridge: TextAttachmentBridge,
	options: ImageAttachmentOptions,
): NativeObjectHandle | null {
	if (!bridge.getClass('YYTextAttachment')) {
		return null;
	}

	const { attributes, image, size, leading = 0, trailing = 0 } = options;
	const attachment = bridge.alloc('YYTextAttachment');

	bridge.call(attachment, 'setValue:forKey:', image, 'content');
	bridge.call(attachment, 'setValue:forKey:', 1, 'contentMode');
	bridge.call(
		attachment,
		'setValue:forKey:',
		bridge.struct('UIEdgeInsets', { top: 0, left: leading, bottom: 0, right: trailing }),
		'contentInsets',
	);

	const result = bridge.alloc('NSMutableAttributedString');

	bridge.call(result, 'initWithString:attributes:', ATTACHMENT_CHARACTER, attributes);
	bridge.call(
		result,
		'addAttribute:value:range:',
		'YYTextAttachment',
		attachment,
		range(bridge, 0, 1),
	);

	const font = fontOf(attributes);

	if (!font || !bridge.getClass('YYTextRunDelegate')) {
		return result;
	}

	const delegate = bridge.alloc('YYTextRunDelegate');

	bridge.call(delegate, 'setValue:forKey:', numeric(bridge.call(font, 'ascender')), 'ascent');
	bridge.call(delegate, 'setValue:forKey:', -numeric(bridge.call(font, 'descender')), 'descent');
	bridge.call(delegate, 'setValue:forKey:', leading + size + trailing, 'width');

	const runDelegate = bridge.call(delegate, 'CTRunDelegate');

	if (runDelegate) {
		bridge.call(
			result,
			'addAttribute:value:range:',
			'CTRunDelegate',
			runDelegate,
			range(bridge, 0, 1),
		);
	}

	return result;
}

/**
 * @description Builds a one-character attributed string that draws an image inline with message text.
 * @param bridge The attachment bridge.
 * @param engine The text view's layout engine.
 * @param options The image, its size and spacing, and the surrounding text's attributes.
 * @returns The attributed string to insert, or `null` when the engine's attachment class is missing.
 */
export function imageAttachment(
	bridge: TextAttachmentBridge,
	engine: TextEngine,
	options: ImageAttachmentOptions,
): NativeObjectHandle | null {
	return engine === 'textkit' ? textKitImage(bridge, options) : yyTextImage(bridge, options);
}

function blankImage(bridge: TextAttachmentBridge): NativeObjectHandle {
	const image = bridge.alloc('UIImage');

	bridge.call(image, 'init');

	return image;
}

function textKitView(
	bridge: TextAttachmentBridge,
	options: ViewAttachmentOptions,
): NativeObjectHandle | null {
	if (!bridge.getClass('NSTextAttachment')) {
		return null;
	}

	const { attributes, width, height } = options;
	const attachment = bridge.alloc('NSTextAttachment');

	bridge.call(attachment, 'init');
	bridge.call(attachment, 'setImage:', blankImage(bridge));
	bridge.call(
		attachment,
		'setBounds:',
		bridge.struct('CGRect', { origin: { x: 0, y: 0 }, size: { width, height } }),
	);

	const result = bridge.alloc('NSMutableAttributedString');

	bridge.call(result, 'initWithString:attributes:', ATTACHMENT_CHARACTER, attributes);
	bridge.call(
		result,
		'addAttribute:value:range:',
		'NSAttachment',
		attachment,
		range(bridge, 0, 1),
	);

	return result;
}

function yyTextView(
	bridge: TextAttachmentBridge,
	options: ViewAttachmentOptions,
): NativeObjectHandle | null {
	if (!bridge.getClass('YYTextAttachment')) {
		return null;
	}

	const { attributes, view, width, height } = options;
	const attachment = bridge.alloc('YYTextAttachment');

	bridge.call(attachment, 'setValue:forKey:', view, 'content');
	bridge.call(attachment, 'setValue:forKey:', 1, 'contentMode');

	const result = bridge.alloc('NSMutableAttributedString');

	bridge.call(result, 'initWithString:attributes:', ATTACHMENT_CHARACTER, attributes);
	bridge.call(
		result,
		'addAttribute:value:range:',
		'YYTextAttachment',
		attachment,
		range(bridge, 0, 1),
	);

	if (!bridge.getClass('YYTextRunDelegate')) {
		return result;
	}

	const delegate = bridge.alloc('YYTextRunDelegate');

	bridge.call(delegate, 'setValue:forKey:', height, 'ascent');
	bridge.call(delegate, 'setValue:forKey:', 0, 'descent');
	bridge.call(delegate, 'setValue:forKey:', width, 'width');

	const runDelegate = bridge.call(delegate, 'CTRunDelegate');

	if (runDelegate) {
		bridge.call(
			result,
			'addAttribute:value:range:',
			'CTRunDelegate',
			runDelegate,
			range(bridge, 0, 1),
		);
	}

	return result;
}

/**
 * @description Builds a one-character attributed string that reserves room for a view inside message text.
 * @param bridge The attachment bridge.
 * @param engine The text view's layout engine.
 * @param options The view, the room to reserve for it, and the surrounding text's attributes.
 * @returns The attributed string to insert, or `null` when the engine's attachment class is missing.
 */
export function viewAttachment(
	bridge: TextAttachmentBridge,
	engine: TextEngine,
	options: ViewAttachmentOptions,
): NativeObjectHandle | null {
	return engine === 'textkit' ? textKitView(bridge, options) : yyTextView(bridge, options);
}

function hasAttribute(
	bridge: TextAttachmentBridge,
	text: NativeObjectHandle,
	index: number,
	key: string,
): boolean {
	const attributes = bridge.call(text, 'attributesAtIndex:effectiveRange:', index, null);

	return isAttributes(attributes) && Boolean(attributes[key]);
}

function isAttributes(value: TextAttachmentValue): value is NativeHandle & TextAttributes {
	return typeof value === 'object' && value !== null;
}

/**
 * @description Widens a range to cover the whole run of text that carries an attribute.
 * @param bridge The attachment bridge.
 * @param text The attributed text.
 * @param span The range to widen.
 * @param key The attribute marking the run, such as Discord's code block layers.
 * @returns The widened range, or the original when its start does not carry the attribute.
 */
export function attributeRun(
	bridge: TextAttachmentBridge,
	text: NativeObjectHandle,
	span: TextRange,
	key: string,
): TextRange {
	const length = numeric(bridge.call(text, 'length'));
	let { start, end } = span;

	if (start >= length || !hasAttribute(bridge, text, start, key)) {
		return span;
	}

	while (start > 0 && hasAttribute(bridge, text, start - 1, key)) {
		start--;
	}

	while (end < length && hasAttribute(bridge, text, end, key)) {
		end++;
	}

	return { start, end };
}

type Inset = { top: number; left: number };

function readInset(value: TextAttachmentValue): Inset {
	if (!isAttributes(value)) {
		return { top: 0, left: 0 };
	}

	const boxed = value.value ?? null;
	const inset = isAttributes(boxed) ? boxed : value;

	return { top: Number(inset.top ?? 0), left: Number(inset.left ?? 0) };
}

/**
 * @description Positions views over the attachments that reserve their room in a TextKit text view, skipping any not laid out yet.
 * @param bridge The attachment bridge.
 * @param textView The message text view.
 * @param views Each view with the index of the attachment character that reserves its room.
 * @returns Resolves once every view is placed.
 */
export async function placeAttachedViews(
	bridge: TextAttachmentBridge,
	textView: NativeObjectHandle,
	views: AttachedView[],
): Promise<void> {
	const layoutManager = bridge.call(textView, 'layoutManager');
	const textContainer = bridge.call(textView, 'textContainer');

	if (!isAttributes(layoutManager) || !isAttributes(textContainer)) {
		return;
	}

	const inset = readInset(bridge.call(textView, 'textContainerInset'));

	for (const { view, index } of views) {
		const glyph = numeric(bridge.call(layoutManager, 'glyphIndexForCharacterAtIndex:', index));
		const rect = readRect(
			bridge.call(
				layoutManager,
				'boundingRectForGlyphRange:inTextContainer:',
				range(bridge, glyph, 1),
				textContainer,
			),
		);

		if (rect.width <= 0 || rect.height <= 0) {
			continue;
		}

		await bridge.callAsync(
			view,
			'setFrame:',
			bridge.struct('CGRect', {
				origin: { x: rect.x + inset.left, y: rect.y + inset.top },
				size: { width: rect.width, height: rect.height },
			}),
		);

		if (bridge.call(view, 'superview') !== textView) {
			await bridge.callAsync(textView, 'addSubview:', view);
		}
	}
}

/**
 * @description Takes views placed over TextKit attachments back out of their text view.
 * @param bridge The attachment bridge.
 * @param views The views to remove.
 * @returns Resolves once every view is removed.
 */
export async function removeAttachedViews(
	bridge: TextAttachmentBridge,
	views: NativeObjectHandle[],
): Promise<void> {
	for (const view of views) {
		await bridge.callAsync(view, 'removeFromSuperview');
	}
}

export default {
	ATTACHMENT_CHARACTER,
	CODE_BLOCK_ATTRIBUTE,
	MESSAGE_TEXT_VIEW_CLASSES,
	attributeRun,
	imageAttachment,
	messageTextViewClass,
	placeAttachedViews,
	removeAttachedViews,
	viewAttachment,
	isAttachmentRun,
	isTappableRun,
	isTextBoundary,
	textAttachmentBridge,
	textEngine,
};
