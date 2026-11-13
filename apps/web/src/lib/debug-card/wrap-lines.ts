import type { Span } from './spans';

/**
 * @description Cuts spans to fit a line, ending a cut one with `…`.
 * @param spans The spans.
 * @param room How many characters fit.
 * @returns The spans that fit.
 */
export function clipped(spans: Span[], room: number): Span[] {
	const kept: Span[] = [];
	let left = room;

	for (const span of spans) {
		if (left <= 0) {
			break;
		}

		if (span.text.length <= left) {
			kept.push(span);
			left -= span.text.length;
		} else {
			kept.push({
				...span,
				text: `${span.text.slice(0, Math.max(0, left - 1))}…`,
			});
			left = 0;
		}
	}

	return kept;
}

const MAX_ROW_LINES = 3;

function merged(line: Span[]): Span[] {
	return line.reduce<Span[]>((runs, span) => {
		const previous = runs[runs.length - 1];

		if (previous?.color === span.color) {
			runs[runs.length - 1] = { ...previous, text: previous.text + span.text };
		} else {
			runs.push(span);
		}

		return runs;
	}, []);
}
const SEPARATOR = ' · ';

function pieces(spans: Span[]): Span[] {
	return spans.flatMap((span) =>
		span.text
			.split(/( · )/)
			.filter(Boolean)
			.map((text) => ({ ...span, text })),
	);
}

function lineLength(line: Span[]): number {
	return line.reduce((length, span) => length + span.text.length, 0);
}

/**
 * @description Wraps a row's spans onto as many lines as it needs, breaking between ` · ` parts.
 * @param spans The row's value.
 * @param room How many characters fit on one line.
 * @returns The lines; a row longer than three lines ends its last line with `…`.
 */
export function wrapped(spans: Span[], room: number): Span[][] {
	const lines: Span[][] = [[]];

	for (const piece of pieces(spans)) {
		const line = lines[lines.length - 1]!;

		if (lineLength(line) + piece.text.length <= room) {
			line.push(piece);
		} else if (piece.text === SEPARATOR) {
			lines.push([]);
		} else {
			if (line[line.length - 1]?.text === SEPARATOR) {
				line.pop();
			}

			lines.push([...clipped([piece], room)]);
		}
	}

	const kept = lines.filter((line) => line.length > 0).map(merged);

	if (kept.length <= MAX_ROW_LINES) {
		return kept;
	}

	const last = kept[MAX_ROW_LINES - 1]!;

	return [
		...kept.slice(0, MAX_ROW_LINES - 1),
		clipped([...last, { ...last[last.length - 1]!, text: ' …' }], room),
	];
}
