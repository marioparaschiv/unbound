import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { safeInvoke } from '@unbound-plugins/shared/native/safe-invoke';
import {
	isAttachmentRun,
	textAttachmentBridge,
	viewAttachment,
	type TextEngine,
} from '@unbound-plugins/shared/native/text-attachments';

import { nativeString } from '~/native/objc';
import type { TextRange } from '~/link-targets';
import { Surface } from '~/constants';

type FontRun = { NSFont?: NativeObjectHandle };

type Insertion = {
	host: NativeObjectHandle;
	original: NativeObjectHandle;
	range: TextRange;
	font: NativeObjectHandle | null;
	width: number;
	height: number;
	engine: TextEngine;
};

export type SurfaceInsertion = {
	text: NativeObjectHandle;
	attachmentOffset: number;
};

/**
 * @description Reads the font of the attachment that draws a rendered channel mention.
 * @param objc The Objective-C bridge.
 * @param attributedText The label's attributed text.
 * @param range The mention's range.
 * @returns The mention's font, or `null` when it has none.
 */
export function linkFont(
	objc: NativeObjCBridge,
	attributedText: NativeObjectHandle,
	range: TextRange,
): NativeObjectHandle | null {
	const text = nativeString(objc, safeInvoke(objc, attributedText, 'string')) ?? '';

	for (let index = range.location, end = range.location + range.length; index < end; index++) {
		if (text[index] !== '\uFFFC') continue;

		const attributes = safeInvoke(
			objc,
			attributedText,
			'attributesAtIndex:effectiveRange:',
			index,
			null,
		);

		if (!isFontRun(attributes) || !isAttachmentRun(attributes)) continue;

		return attributes.NSFont ?? null;
	}

	return null;
}

function isFontRun(value: unknown): value is FontRun {
	return typeof value === 'object' && value !== null;
}

function plainText(objc: NativeObjCBridge, value: string, font: NativeObjectHandle | null) {
	const text = objc.alloc('NSMutableAttributedString');

	safeInvoke(objc, text, 'initWithString:attributes:', value, font ? { NSFont: font } : {});

	return text;
}

/**
 * @description Builds the text inserted after a channel mention: a line break, a small spacer line, and an attachment reserving the embed's size.
 * @param objc The Objective-C bridge.
 * @param insertion The host view, the label's original text, the mention's range and font, the embed's size and the label's text engine.
 * @returns The attributed string to insert and where its attachment sits in it, or `null` when the engine's attachment class is missing.
 */
export function surfaceInsertion(
	objc: NativeObjCBridge,
	{ host, original, range, font, width, height, engine }: Insertion,
): SurfaceInsertion | null {
	const attachment = viewAttachment(textAttachmentBridge(objc), engine, {
		attributes: font ? { NSFont: font } : {},
		view: host,
		width,
		height,
	});

	if (!attachment) return null;

	const sourceText = nativeString(objc, safeInvoke(objc, original, 'string')) ?? '';
	const insertAt = range.location + range.length;
	const leadingNewline = sourceText[insertAt - 1] === '\n' ? '' : '\n';
	const trailingNewline = sourceText.slice(insertAt).trim().length > 0 ? '\n' : '';
	const spacerFont = font
		? (safeInvoke(
				objc,
				font,
				'fontWithSize:',
				Surface.spacerFontSize,
			) as NativeObjectHandle | null)
		: null;
	const insertion = objc.alloc('NSMutableAttributedString');

	safeInvoke(objc, insertion, 'init');

	for (const part of [
		plainText(objc, leadingNewline, font),
		plainText(objc, '\u200B\n', spacerFont ?? font),
		attachment,
		plainText(objc, trailingNewline, font),
	]) {
		safeInvoke(objc, insertion, 'appendAttributedString:', part);
	}

	return { text: insertion, attachmentOffset: leadingNewline.length + 2 };
}
