import type { NativeObjectHandle } from '@unbound-app/api/native';
import { viewAttachment } from '@unbound-plugins/shared/native/text-attachments';

import type { LineOverflow } from '~/preferences';
import type { TokenLines } from '~/highlighter';
import { buildCodeMarkup } from '~/markup';
import { Palette, PLUGIN_ID } from '~/constants';

import type { Session, Surface } from './session';
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

function separators(surface: Surface, text: string, start: number, end: number, cursor: number) {
	if (surface.engine === 'yytext') {
		return {
			before: start > cursor ? '\n\u200B\n' : '\u200B\n',
			after: end < text.length ? '\n' : '',
		};
	}

	return {
		before: start > 0 && text[start - 1] !== '\n' ? '\n' : '',
		after: end < text.length && text[end] !== '\n' ? '\n' : '',
	};
}

/**
 * @description Rebuilds a message's attributed text with each code block replaced by an attachment reserving its card's room, recording where each attachment lands.
 * @param session The renderer session.
 * @param surface The surface whose parts hold the cards and their ranges in the original text.
 * @returns The new attributed text, or `null` when the engine's attachment class is missing or a range could not be copied.
 */
export function textWithCards(
	{ ui, text: bridge }: Session,
	surface: Surface,
): NativeObjectHandle | null {
	const { call, objc, range } = ui;

	function copyOriginal(start: number, end: number) {
		return ui.view(
			surface.original,
			'attributedSubstringFromRange:',
			range(start, end - start),
		);
	}

	function appendPlain(attributed: NativeObjectHandle, value: string) {
		if (!value) return;

		const plain = objc.alloc('NSMutableAttributedString');

		call(plain, 'initWithString:attributes:', value, { NSFont: ui.font(1, 0, false) });
		call(attributed, 'appendAttributedString:', plain);
	}

	try {
		const originalText = ui.string(call(surface.original, 'string')) ?? '';
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

			const attachment = viewAttachment(bridge, surface.engine, {
				attributes: { NSFont: ui.font(1, 0, false) },
				view: part.host.host,
				width: surface.width,
				height: part.height,
				owner: PLUGIN_ID,
			});

			if (!attachment) return null;

			const separator = separators(surface, originalText, start, end, cursor);

			appendPlain(attributed, separator.before);
			part.attachmentIndex = Number(call(attributed, 'length') ?? 0);
			call(attributed, 'appendAttributedString:', attachment);
			appendPlain(attributed, separator.after);
			cursor = end;
		}

		if (cursor < originalText.length) {
			const after = copyOriginal(cursor, originalText.length);

			if (!after) return null;

			call(attributed, 'appendAttributedString:', after);
		}

		return attributed;
	} catch {
		return null;
	}
}

export default { highlightedCode, textWithCards };
