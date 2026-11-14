import { BLACKBOARD, COMMANDS, FUNCTIONS, SUBSCRIPTS, SUPERSCRIPTS } from '~/lib/symbols';

type Cursor = { text: string; index: number };

const TEXT_COMMANDS = new Set([
	'text',
	'mathrm',
	'mathit',
	'mathbf',
	'textbf',
	'textit',
	'operatorname',
	'mathsf',
]);
const ACCENTS: Record<string, string> = {
	vec: '\u20d7',
	hat: '\u0302',
	bar: '\u0305',
	overline: '\u0305',
	tilde: '\u0303',
	dot: '\u0307',
};
const SIMPLE = /^[\p{L}\p{N}.′]+$/u;

function skipSpaces(cursor: Cursor): void {
	while (cursor.text[cursor.index] === ' ') cursor.index++;
}

function readName(cursor: Cursor): string {
	const start = cursor.index;

	while (/[A-Za-z]/.test(cursor.text[cursor.index] ?? '')) cursor.index++;

	return cursor.index > start
		? cursor.text.slice(start, cursor.index)
		: (cursor.text[cursor.index++] ?? '');
}

function readRawGroup(cursor: Cursor): string {
	skipSpaces(cursor);

	if (cursor.text[cursor.index] !== '{') return cursor.text[cursor.index++] ?? '';

	let depth = 0;
	const start = cursor.index + 1;

	for (; cursor.index < cursor.text.length; cursor.index++) {
		const char = cursor.text[cursor.index];

		if (char === '{') depth++;
		if (char === '}' && --depth === 0) break;
	}

	return cursor.text.slice(start, cursor.index++);
}

function readArgument(cursor: Cursor): string {
	skipSpaces(cursor);

	if (cursor.text[cursor.index] === '{') return convert(readRawGroup(cursor));
	if (cursor.text[cursor.index] === '\\') {
		cursor.index++;

		return command(cursor, readName(cursor));
	}

	return cursor.text[cursor.index++] ?? '';
}

function wrap(text: string): string {
	return SIMPLE.test(text) ? text : `(${text})`;
}

function scripted(text: string, table: Record<string, string>, marker: string): string {
	const mapped = Array.from(text).map((char) => table[char]);

	return mapped.every(Boolean)
		? mapped.join('')
		: `${marker}${Array.from(text).length > 1 ? `(${text})` : text}`;
}

function command(cursor: Cursor, name: string): string {
	if (FUNCTIONS.has(name)) return name;
	if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
		const numerator = readArgument(cursor);

		return `${wrap(numerator)}/${wrap(readArgument(cursor))}`;
	}
	if (name === 'sqrt') {
		skipSpaces(cursor);

		const root = cursor.text[cursor.index] === '[' ? readRoot(cursor) : '';

		return `${root ? scripted(root, SUPERSCRIPTS, '') : ''}√${wrap(readArgument(cursor))}`;
	}
	if (name === 'mathbb')
		return Array.from(readRawGroup(cursor))
			.map((char) => BLACKBOARD[char] ?? char)
			.join('');
	if (TEXT_COMMANDS.has(name)) return readRawGroup(cursor);
	if (name === 'left' || name === 'right') {
		skipSpaces(cursor);

		return cursor.text[cursor.index] === '\\'
			? ''
			: (cursor.text[cursor.index++] ?? '').replace('.', '');
	}

	const accent = ACCENTS[name];

	if (accent)
		return Array.from(readArgument(cursor))
			.map((char) => `${char}${accent}`)
			.join('');

	return COMMANDS[name] ?? `\\${name}`;
}

function readRoot(cursor: Cursor): string {
	const end = cursor.text.indexOf(']', cursor.index);

	if (end < 0) return '';

	const root = cursor.text.slice(cursor.index + 1, end);

	cursor.index = end + 1;

	return convert(root);
}

/**
 * @description Turns TeX math into plain Unicode: Greek letters and operators become symbols, `^` and `_` become
 * superscripts and subscripts where Unicode has them, and `\frac`, `\sqrt` and `\mathbb` are written out.
 * @param tex The math, without its delimiters.
 * @returns The readable text; unknown commands are kept as written.
 */
export function convert(tex: string): string {
	const cursor: Cursor = { text: tex, index: 0 };
	let output = '';

	while (cursor.index < tex.length) {
		const char = tex[cursor.index++] ?? '';

		if (char === '\\') output += command(cursor, readName(cursor));
		else if (char === '^') output += scripted(readArgument(cursor), SUPERSCRIPTS, '^');
		else if (char === '_') output += scripted(readArgument(cursor), SUBSCRIPTS, '_');
		else if (char === '{') {
			cursor.index--;
			output += convert(readRawGroup(cursor));
		} else if (char !== '}') output += char;
	}

	return output.replace(/ {2,}/g, ' ');
}

export default convert;
