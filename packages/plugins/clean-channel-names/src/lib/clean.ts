const SMALL_CAPS: Record<string, string> = {
	ᴀ: 'a',
	ʙ: 'b',
	ᴄ: 'c',
	ᴅ: 'd',
	ᴇ: 'e',
	ꜰ: 'f',
	ɢ: 'g',
	ʜ: 'h',
	ɪ: 'i',
	ᴊ: 'j',
	ᴋ: 'k',
	ʟ: 'l',
	ᴍ: 'm',
	ɴ: 'n',
	ᴏ: 'o',
	ᴘ: 'p',
	ǫ: 'q',
	ʀ: 'r',
	ꜱ: 's',
	ᴛ: 't',
	ᴜ: 'u',
	ᴠ: 'v',
	ᴡ: 'w',
	ʏ: 'y',
	ᴢ: 'z',
};

const VOICE_TYPES = new Set([2, 13]);

const DECORATION_RANGES: readonly (readonly [number, number])[] = [
	[0x00a6, 0x00a9],
	[0x00ae, 0x00b0],
	[0x00b7, 0x00b7],
	[0x2000, 0x2bff],
	[0x3000, 0x303f],
	[0x30fb, 0x30fb],
	[0xfe00, 0xfe0f],
	[0xff5c, 0xff5c],
	[0x1f000, 0x1faff],
	[0xe0000, 0xe007f],
];

/** How a channel name is cleaned. */
export type CleanOptions = { spaces: boolean };

function isDecoration(character: string): boolean {
	const point = character.codePointAt(0) ?? 0;

	return (
		character === '|' ||
		character === '-' ||
		DECORATION_RANGES.some(([start, end]) => point >= start && point <= end)
	);
}

/**
 * @description Cleans a channel name: decorative letters become plain ones, emoji and symbol separators go, and text
 * channel dashes become spaces when asked.
 * @param name The channel's name.
 * @param type The channel's type; voice and stage channels already use spaces.
 * @param options Whether dashes become spaces.
 * @returns The clean name, or the original when cleaning would leave nothing.
 */
export function cleanChannelName(
	name: string,
	type: number | undefined,
	{ spaces }: CleanOptions,
): string {
	const separator = spaces || VOICE_TYPES.has(type ?? -1) ? ' ' : '-';
	const words: string[] = [];
	let word = '';

	for (const raw of name.normalize('NFKC')) {
		const character = SMALL_CAPS[raw] ?? raw;

		if (isDecoration(character) || character === ' ') {
			if (word) words.push(word);
			word = '';
		} else {
			word += character;
		}
	}

	if (word) words.push(word);

	return words.length ? words.join(separator) : name;
}
