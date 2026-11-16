export type DiffPart = { kind: 'same' | 'added' | 'removed'; text: string };

export type PreviewOptions = { minLength: number; code: boolean };

const MAX_TOKENS = 2000;

function tokenize(text: string): string[] {
	return text.split(/(\s+)/).filter((token) => token !== '');
}

function push(parts: DiffPart[], kind: DiffPart['kind'], text: string) {
	const last = parts.at(-1);

	if (last?.kind === kind) {
		last.text += text;
	} else {
		parts.push({ kind, text });
	}
}

function lcsTable(before: string[], after: string[]): Uint32Array {
	const width = after.length + 1;
	const table = new Uint32Array((before.length + 1) * width);

	for (let row = before.length - 1; row >= 0; row--) {
		for (let column = after.length - 1; column >= 0; column--) {
			table[row * width + column] =
				before[row] === after[column]
					? table[(row + 1) * width + column + 1]! + 1
					: Math.max(
							table[(row + 1) * width + column]!,
							table[row * width + column + 1]!,
						);
		}
	}

	return table;
}

function diffTokens(before: string[], after: string[]): DiffPart[] {
	const table = lcsTable(before, after);
	const width = after.length + 1;
	const parts: DiffPart[] = [];
	let row = 0;
	let column = 0;

	while (row < before.length && column < after.length) {
		if (before[row] === after[column]) {
			push(parts, 'same', before[row++]!);
			column++;
		} else if (table[(row + 1) * width + column]! >= table[row * width + column + 1]!) {
			push(parts, 'removed', before[row++]!);
		} else {
			push(parts, 'added', after[column++]!);
		}
	}

	while (row < before.length) push(parts, 'removed', before[row++]!);
	while (column < after.length) push(parts, 'added', after[column++]!);

	return parts;
}

function trimmedEnds(before: string[], after: string[]) {
	let start = 0;

	while (start < before.length && start < after.length && before[start] === after[start]) start++;

	let end = 0;

	while (
		end < before.length - start &&
		end < after.length - start &&
		before[before.length - 1 - end] === after[after.length - 1 - end]
	) {
		end++;
	}

	return { start, end };
}

/**
 * @description Compares two texts word by word, keeping whitespace, and marks what stayed, what was added and what was
 * removed. Texts with more than 2,000 changed words in the middle compare as one removal and one addition.
 * @param before The text before the edit.
 * @param after The text after the edit.
 * @returns The parts in order, with neighbours of the same kind merged.
 */
export function diffWords(before: string, after: string): DiffPart[] {
	const old = tokenize(before);
	const next = tokenize(after);
	const { start, end } = trimmedEnds(old, next);
	const parts: DiffPart[] = [];
	const middleOld = old.slice(start, old.length - end);
	const middleNew = next.slice(start, next.length - end);

	if (start > 0) push(parts, 'same', old.slice(0, start).join(''));

	if (middleOld.length > MAX_TOKENS || middleNew.length > MAX_TOKENS) {
		if (middleOld.length) push(parts, 'removed', middleOld.join(''));
		if (middleNew.length) push(parts, 'added', middleNew.join(''));
	} else {
		for (const part of diffTokens(middleOld, middleNew)) push(parts, part.kind, part.text);
	}

	if (end > 0) push(parts, 'same', old.slice(old.length - end).join(''));

	return parts;
}

/**
 * @description Shortens unchanged stretches longer than `keep` characters on each side to their ends around an
 * ellipsis, so the changes stay in view.
 * @param parts The diff.
 * @param keep How many characters of context to keep beside each change.
 * @returns The diff with long unchanged stretches shortened.
 */
export function collapseSame(parts: DiffPart[], keep = 40): DiffPart[] {
	return parts.map((part, index) => {
		if (part.kind !== 'same' || part.text.length <= keep * 2 + 3) return part;

		const head = index === 0 ? '' : part.text.slice(0, keep);
		const tail = index === parts.length - 1 ? '' : part.text.slice(-keep);

		return { kind: 'same', text: `${head}…${tail}` };
	});
}

/**
 * @description Whether an edit is worth showing before saving: long messages, messages with code, or any edit when
 * the user asks for every one.
 * @param before The text before the edit.
 * @param after The text after the edit.
 * @param options The shortest message that asks, and whether code always asks.
 * @returns `true` to show the changes first.
 */
export function shouldPreview(
	before: string,
	after: string,
	{ minLength, code }: PreviewOptions,
): boolean {
	if (before === after) return false;

	return (
		Math.max(before.length, after.length) >= minLength ||
		(code && (before.includes('```') || after.includes('```')))
	);
}

export default { diffWords, collapseSame, shouldPreview };
