import type { Span } from './spans';

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

function broken(piece: Span, room: number): Span[] {
	const parts: Span[] = [];
	let rest = piece.text;

	while (rest.length > room) {
		const space = rest.lastIndexOf(' ', room);
		const cut = space > 0 ? space : room;

		parts.push({ ...piece, text: rest.slice(0, cut) });
		rest = rest.slice(cut).trimStart();
	}

	return rest ? [...parts, { ...piece, text: rest }] : parts;
}

/**
 * @description Wraps a row's spans onto as many lines as it needs, breaking between ` · ` parts, then at spaces.
 * @param spans The row's value.
 * @param room How many characters fit on one line.
 * @returns Every line of the row; nothing is cut.
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

			for (const part of broken(piece, room)) {
				lines.push([part]);
			}
		}
	}

	return lines.filter((line) => line.length > 0).map(merged);
}
