import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { safeInvoke } from '@unbound-plugins/shared/native/safe-invoke';

import { nativeRange, nativeString } from '~/native/objc';
import type { TextRange } from '~/link-targets';
import { Surface } from '~/constants';

type Insertion = {
	host: NativeObjectHandle;
	original: NativeObjectHandle;
	range: TextRange;
	font: NativeObjectHandle | null;
	width: number;
	height: number;
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
		) as { YYTextAttachment?: unknown; NSFont?: NativeObjectHandle } | null;

		if (!attributes || typeof attributes !== 'object' || !attributes.YYTextAttachment) continue;

		return attributes.NSFont ?? null;
	}

	return null;
}

/**
 * @description Builds the text inserted after a channel mention: a line break, a small spacer line, and an attachment that holds the embed's host view at its size.
 * @param objc The Objective-C bridge.
 * @param insertion The host view, the label's original text, the mention's range and font, and the embed's size.
 * @returns The attributed string to insert, or `null` when YYText's attachment class is missing.
 */
export function surfaceInsertion(
	objc: NativeObjCBridge,
	{ host, original, range, font, width, height }: Insertion,
): NativeObjectHandle | null {
	const attachmentClass = objc.getClass('YYTextAttachment');

	if (!attachmentClass) return null;

	const attachment = objc.alloc(attachmentClass);

	safeInvoke(objc, attachment, 'setValue:forKey:', host, 'content');
	safeInvoke(objc, attachment, 'setValue:forKey:', 1, 'contentMode');

	const sourceText = nativeString(objc, safeInvoke(objc, original, 'string')) ?? '';
	const insertAt = range.location + range.length;
	const leadingNewline = sourceText[insertAt - 1] === '\n' ? '' : '\n';
	const trailingNewline = sourceText.slice(insertAt).trim().length > 0 ? '\n' : '';
	const spacer = '\u200B\n';
	const spacerLocation = leadingNewline.length;
	const attachmentLocation = spacerLocation + spacer.length;
	const insertion = objc.alloc('NSMutableAttributedString');

	safeInvoke(
		objc,
		insertion,
		'initWithString:attributes:',
		`${leadingNewline}${spacer}\uFFFC${trailingNewline}`,
		font ? { NSFont: font } : {},
	);

	const spacerFont = font
		? (safeInvoke(
				objc,
				font,
				'fontWithSize:',
				Surface.spacerFontSize,
			) as NativeObjectHandle | null)
		: null;

	if (spacerFont) {
		safeInvoke(
			objc,
			insertion,
			'addAttribute:value:range:',
			'NSFont',
			spacerFont,
			nativeRange(objc, spacerLocation, spacer.length),
		);
	}

	safeInvoke(
		objc,
		insertion,
		'addAttribute:value:range:',
		'YYTextAttachment',
		attachment,
		nativeRange(objc, attachmentLocation, 1),
	);

	// The run delegate reserves the embed's size in the label's layout.
	const delegateClass = objc.getClass('YYTextRunDelegate');

	if (!delegateClass) return insertion;

	const delegate = objc.alloc(delegateClass);

	safeInvoke(objc, delegate, 'setValue:forKey:', height, 'ascent');
	safeInvoke(objc, delegate, 'setValue:forKey:', 0, 'descent');
	safeInvoke(objc, delegate, 'setValue:forKey:', width, 'width');

	const runDelegate = safeInvoke(objc, delegate, 'CTRunDelegate');

	if (runDelegate) {
		safeInvoke(
			objc,
			insertion,
			'addAttribute:value:range:',
			'CTRunDelegate',
			runDelegate,
			nativeRange(objc, attachmentLocation, 1),
		);
	}

	return insertion;
}
