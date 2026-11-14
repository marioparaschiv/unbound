/** How a run of composer text is drawn. */
export type MarkdownStyle =
	| 'bold'
	| 'italic'
	| 'underline'
	| 'strike'
	| 'code'
	| 'spoiler'
	| 'marker'
	| 'heading1'
	| 'heading2'
	| 'heading3'
	| 'subtext'
	| 'quote';

/** A styled run, as a start index and length into the text. */
export type MarkdownRun = { start: number; length: number; style: MarkdownStyle };

type Inline = { open: string; style: MarkdownStyle };

const INLINE: Inline[] = [
	{ open: '||', style: 'spoiler' },
	{ open: '**', style: 'bold' },
	{ open: '__', style: 'underline' },
	{ open: '~~', style: 'strike' },
	{ open: '*', style: 'italic' },
	{ open: '_', style: 'italic' },
];

const BLOCKS: [string, MarkdownStyle][] = [
	['### ', 'heading3'],
	['## ', 'heading2'],
	['# ', 'heading1'],
	['-# ', 'subtext'],
	['> ', 'quote'],
];

function codeRuns(text: string, runs: MarkdownRun[]): boolean[] {
	'worklet';
	const covered: boolean[] = Array.from({ length: text.length }, () => false);
	const pattern = /```[\s\S]*?```|`[^`\n]+`/g;

	for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
		const fence = match[0].startsWith('```') ? 3 : 1;

		runs.push({ start: match.index, length: fence, style: 'marker' });
		runs.push({
			start: match.index + fence,
			length: match[0].length - fence * 2,
			style: 'code',
		});
		runs.push({ start: match.index + match[0].length - fence, length: fence, style: 'marker' });

		for (let at = match.index; at < match.index + match[0].length; at++) covered[at] = true;
	}

	return covered;
}

function blockRuns(text: string, runs: MarkdownRun[], covered: boolean[]) {
	'worklet';
	let lineStart = 0;

	for (const line of text.split('\n')) {
		const block = covered[lineStart]
			? undefined
			: BLOCKS.find(([prefix]) => line.startsWith(prefix));

		if (block && line.length > block[0].length) {
			runs.push({ start: lineStart, length: block[0].length, style: 'marker' });
			runs.push({
				start: lineStart + block[0].length,
				length: line.length - block[0].length,
				style: block[1],
			});
		}

		lineStart += line.length + 1;
	}
}

function inlineRuns(text: string, runs: MarkdownRun[], covered: boolean[]) {
	'worklet';
	const taken = [...covered];

	for (const { open, style } of INLINE) {
		let from = 0;

		while (from < text.length) {
			const start = text.indexOf(open, from);

			if (start < 0) break;

			const close = text.indexOf(open, start + open.length + 1);
			const inner = close - start - open.length;
			const blocked =
				close < 0 ||
				inner <= 0 ||
				text.slice(start + open.length, close).includes('\n') ||
				taken.slice(start, close + open.length).some(Boolean) ||
				/\s/.test(text[start + open.length] ?? '') ||
				/\s/.test(text[close - 1] ?? '');

			if (blocked) {
				from = start + open.length;
				continue;
			}

			runs.push({ start, length: open.length, style: 'marker' });
			runs.push({ start: start + open.length, length: inner, style });
			runs.push({ start: close, length: open.length, style: 'marker' });

			for (const at of [start, start + 1, close, close + 1].slice(0, open.length * 2))
				taken[at] = true;
			for (let at = start; at < start + open.length; at++) taken[at] = true;
			for (let at = close; at < close + open.length; at++) taken[at] = true;

			from = close + open.length;
		}
	}
}

/**
 * @description Finds the markdown Discord renders in a message as it is typed: code, headings, subtext, quotes, spoilers,
 * bold, underline, strikethrough and italics, with their markers as separate runs. Nothing inside code is styled.
 * @param text The composer's text.
 * @returns The styled runs, in no particular order.
 */
export function markdownRuns(text: string): MarkdownRun[] {
	'worklet';
	const runs: MarkdownRun[] = [];
	const covered = codeRuns(text, runs);

	blockRuns(text, runs, covered);
	inlineRuns(text, runs, covered);

	return runs.filter((run) => run.length > 0);
}

export default markdownRuns;
