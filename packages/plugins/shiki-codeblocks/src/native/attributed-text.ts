import type { NativeObjectHandle } from '@unbound-app/api/native';

import type { LineOverflow } from '~/preferences';
import type { TokenLines } from '~/highlighter';
import { buildCodeMarkup } from '~/markup';
import { Palette } from '~/constants';

import type { Surface } from './session';
import type { NativeUI } from './ui';

/**
 * @description Builds the highlighted, line-numbered attributed string shown in a code card.
 * @param ui The native helpers.
 * @param tokens The tokens of each line.
 * @param light Whether the card uses the light palette.
 * @param overflow Wrapped lines are indented past the line number.
 * @returns An `NSMutableAttributedString`, or `null` when UIKit refused it.
 */
export function highlightedCode(
	ui: NativeUI,
	tokens: TokenLines,
	light: boolean,
	overflow: LineOverflow,
): NativeObjectHandle | null {
	const { call, range } = ui;

	try {
		const { spans, text } = buildCodeMarkup(tokens, light);
		const attributed = ui.objc.alloc('NSMutableAttributedString');
		const all = range(0, text.length);

		call(attributed, 'initWithString:', text);
		call(attributed, 'addAttribute:value:range:', 'NSFont', ui.font(12, 0, true), all);
		call(
			attributed,
			'addAttribute:value:range:',
			'NSColor',
			ui.color(Palette[light ? 'light' : 'dark'].foreground),
			all,
		);

		if (overflow === 'wrap') {
			const paragraph = ui.objc.alloc('NSMutableParagraphStyle');

			call(paragraph, 'setFirstLineHeadIndent:', 0);
			call(paragraph, 'setHeadIndent:', 22);
			call(attributed, 'addAttribute:value:range:', 'NSParagraphStyle', paragraph, all);
		}

		for (const span of spans) {
			const spanRange = range(span.location, span.length);
			const style = span.fontStyle ?? 0;

			call(
				attributed,
				'addAttribute:value:range:',
				'NSColor',
				ui.color(span.color),
				spanRange,
			);

			if (style & 2) {
				call(
					attributed,
					'addAttribute:value:range:',
					'NSFont',
					ui.font(12, 0.4, true),
					spanRange,
				);
			}

			if (style & 1) {
				call(attributed, 'addAttribute:value:range:', 'NSObliqueness', 0.2, spanRange);
			}

			if (style & 4) {
				call(attributed, 'addAttribute:value:range:', 'NSUnderlineStyle', 1, spanRange);
			}
		}

		return attributed;
	} catch {
		return null;
	}
}

/**
 * @description Rebuilds a message's attributed text with each code block replaced by its card, as a YYText attachment.
 * @param ui The native helpers.
 * @param surface The surface whose parts hold the cards and their ranges in the original text.
 * @returns The new attributed text, or `null` when YYText is missing or a range could not be copied.
 */
export function textWithCards(ui: NativeUI, surface: Surface): NativeObjectHandle | null {
	const { call, objc, range } = ui;
	const YYTextAttachment = objc.getClass('YYTextAttachment');

	if (!YYTextAttachment) return null;

	const YYTextRunDelegate = objc.getClass('YYTextRunDelegate');

	function copyOriginal(start: number, end: number) {
		return ui.view(
			surface.original,
			'attributedSubstringFromRange:',
			range(start, end - start),
		);
	}

	try {
		const originalLength = (ui.string(call(surface.original, 'string')) ?? '').length;
		const attributed = objc.alloc('NSMutableAttributedString');
		let cursor = 0;

		call(attributed, 'initWithString:', '');

		for (const part of surface.parts) {
			const { start, end } = part.placement;

			if (start > cursor) {
				const before = copyOriginal(cursor, start);

				if (!before) return null;

				call(attributed, 'appendAttributedString:', before);
			}

			const attachment = objc.alloc(YYTextAttachment);

			call(attachment, 'setValue:forKey:', part.host.host, 'content');
			call(attachment, 'setValue:forKey:', 1, 'contentMode');

			// A zero-width space keeps the line before the card from collapsing; U+FFFC is the card itself.
			const separator = start > cursor ? '\n\u200B\n' : '\u200B\n';
			const cardRange = range(separator.length, 1);
			const insertion = objc.alloc('NSMutableAttributedString');

			call(
				insertion,
				'initWithString:attributes:',
				`${separator}\uFFFC${end < originalLength ? '\n' : ''}`,
				{ NSFont: ui.font(1, 0, false) },
			);
			call(insertion, 'addAttribute:value:range:', 'YYTextAttachment', attachment, cardRange);

			if (YYTextRunDelegate) {
				const delegate = objc.alloc(YYTextRunDelegate);

				call(delegate, 'setValue:forKey:', part.height, 'ascent');
				call(delegate, 'setValue:forKey:', 0, 'descent');
				call(delegate, 'setValue:forKey:', surface.width, 'width');

				const runDelegate = call(delegate, 'CTRunDelegate');

				if (runDelegate) {
					call(
						insertion,
						'addAttribute:value:range:',
						'CTRunDelegate',
						runDelegate,
						cardRange,
					);
				}
			}

			call(attributed, 'appendAttributedString:', insertion);
			cursor = end;
		}

		if (cursor < originalLength) {
			const after = copyOriginal(cursor, originalLength);

			if (!after) return null;

			call(attributed, 'appendAttributedString:', after);
		}

		return attributed;
	} catch {
		return null;
	}
}

export default { highlightedCode, textWithCards };
