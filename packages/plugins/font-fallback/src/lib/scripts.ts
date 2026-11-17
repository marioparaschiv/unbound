export type ScriptId =
	| 'latin'
	| 'cyrillic'
	| 'greek'
	| 'arabic'
	| 'hebrew'
	| 'devanagari'
	| 'thai'
	| 'han'
	| 'kana'
	| 'hangeul';

export type ScriptRun = { script: ScriptId; start: number; length: number };

type Block = readonly [from: number, to: number];

/** Each writing system the plugin can give its own font, with its Unicode blocks. */
export const SCRIPTS: readonly { id: ScriptId; blocks: readonly Block[] }[] = [
	{
		id: 'latin',
		blocks: [
			[0x41, 0x5a],
			[0x61, 0x7a],
			[0xc0, 0x24f],
			[0x1e00, 0x1eff],
		],
	},
	{
		id: 'cyrillic',
		blocks: [
			[0x400, 0x52f],
			[0x1c80, 0x1c8f],
			[0x2de0, 0x2dff],
			[0xa640, 0xa69f],
		],
	},
	{
		id: 'greek',
		blocks: [
			[0x370, 0x3ff],
			[0x1f00, 0x1fff],
		],
	},
	{
		id: 'arabic',
		blocks: [
			[0x600, 0x6ff],
			[0x750, 0x77f],
			[0x8a0, 0x8ff],
			[0xfb50, 0xfdff],
			[0xfe70, 0xfeff],
		],
	},
	{
		id: 'hebrew',
		blocks: [
			[0x590, 0x5ff],
			[0xfb1d, 0xfb4f],
		],
	},
	{
		id: 'devanagari',
		blocks: [
			[0x900, 0x97f],
			[0xa8e0, 0xa8ff],
		],
	},
	{ id: 'thai', blocks: [[0xe00, 0xe7f]] },
	{
		id: 'han',
		blocks: [
			[0x3400, 0x4dbf],
			[0x4e00, 0x9fff],
			[0xf900, 0xfaff],
			[0x20000, 0x3134f],
		],
	},
	{
		id: 'kana',
		blocks: [
			[0x3040, 0x30ff],
			[0x31f0, 0x31ff],
			[0xff66, 0xff9f],
		],
	},
	{
		id: 'hangeul',
		blocks: [
			[0x1100, 0x11ff],
			[0x3130, 0x318f],
			[0xac00, 0xd7af],
		],
	},
];

function scriptOf(codePoint: number): ScriptId | undefined {
	'worklet';
	for (const { id, blocks } of SCRIPTS) {
		if (blocks.some(([from, to]) => codePoint >= from && codePoint <= to)) return id;
	}

	return undefined;
}

function isJoiner(codePoint: number): boolean {
	'worklet';
	return (
		codePoint === 0x20 || codePoint === 0x3000 || codePoint === 0x200c || codePoint === 0x200d
	);
}

/**
 * @description Splits text into runs of the scripts that have a font, in UTF-16 offsets as native text uses. Spaces
 * between two letters of one script stay inside its run; digits, punctuation and emoji belong to no run.
 * @param text The text.
 * @param wanted The scripts that have a font.
 * @returns The runs, in order.
 */
export function scriptRuns(text: string, wanted: ReadonlySet<ScriptId>): ScriptRun[] {
	'worklet';
	const runs: ScriptRun[] = [];
	let current: ScriptRun | undefined;
	let offset = 0;

	for (const char of text) {
		const codePoint = char.codePointAt(0)!;
		const script = scriptOf(codePoint);

		if (script && wanted.has(script)) {
			if (current?.script === script) {
				current.length = offset + char.length - current.start;
			} else {
				current = { script, start: offset, length: char.length };
				runs.push(current);
			}
		} else if (!current || !isJoiner(codePoint)) {
			current = undefined;
		}

		offset += char.length;
	}

	return runs;
}
