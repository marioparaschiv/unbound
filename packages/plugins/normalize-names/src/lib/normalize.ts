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

const SMALL_CAPS_PATTERN = new RegExp(`[${Object.keys(SMALL_CAPS).join('')}]`, 'g');
const STACKED_MARKS = /\p{M}{2,}/u;
const MARKS = /\p{M}/gu;

/**
 * @description Writes a name in plain letters: mathematical, fullwidth, circled and similar styled letters fold to their
 * plain forms, small caps become lowercase, and a name with stacked combining marks loses its marks. Accents that
 * compose into one letter stay.
 * @param name The display name.
 * @returns The plain name, or the same string when nothing changes or nothing readable would be left.
 */
export function normalizeName(name: string): string {
	const folded = name
		.normalize('NFKC')
		.replace(SMALL_CAPS_PATTERN, (char) => SMALL_CAPS[char] ?? char);
	const plain = (STACKED_MARKS.test(folded) ? folded.replace(MARKS, '') : folded).trim();

	return plain && /[\p{L}\p{N}]/u.test(plain) ? plain : name;
}

export default normalizeName;
