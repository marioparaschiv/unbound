const PROTECTED =
	/(```[\s\S]*?```|`[^`]*`|<@!?\d+>|<@&\d+>|<#\d+>|<a?:[\w~]+:\d+>|<t:\d+(?::[a-zA-Z])?>|https?:\/\/[^\s<]+)/g;
const FACES = ['owo', 'uwu', '>w<', '^w^', ':3', 'OwO', 'UwU', 'nya~'];
const WORDS: [RegExp, string][] = [
	[/\byou\b/gi, 'yuw'],
	[/\bthe\b/gi, 'da'],
	[/\bthis\b/gi, 'dis'],
	[/\bthat\b/gi, 'dat'],
	[/\bwhat\b/gi, 'wat'],
	[/\bhave\b/gi, 'haz'],
	[/\blove\b/gi, 'wuv'],
	[/\bhello\b/gi, 'hewwo'],
	[/\bno\b/gi, 'nyo'],
];

export type UwuOptions = { stutter: boolean; faces: boolean };

/** Picks pseudo-random but repeatable choices from the text, so the same message always comes out the same. */
function seeded(text: string) {
	let state = 0;

	for (const char of text) state = (state * 31 + char.charCodeAt(0)) >>> 0;

	return () => {
		state = (state * 1_103_515_245 + 12_345) >>> 0;

		return state / 0x1_00_00_00_00;
	};
}

function matchCase(source: string, replacement: string): string {
	if (source === source.toUpperCase() && source.length > 1) return replacement.toUpperCase();
	if (source[0] === source[0]?.toUpperCase())
		return replacement[0]!.toUpperCase() + replacement.slice(1);

	return replacement;
}

function uwuifyPlain(text: string, { stutter, faces }: UwuOptions, random: () => number): string {
	let result = text;

	for (const [pattern, replacement] of WORDS) {
		result = result.replace(pattern, (match) => matchCase(match, replacement));
	}

	result = result
		.replace(/[rl]/g, 'w')
		.replace(/[RL]/g, 'W')
		.replace(/n([aeiou])/g, 'ny$1')
		.replace(/N([aeiou])/g, 'Ny$1')
		.replace(/N([AEIOU])/g, 'NY$1')
		.replace(/ove\b/g, 'uv');

	if (stutter) {
		result = result.replace(
			/\b([a-zA-Z])([a-zA-Z]{2,})/g,
			(word, first: string, rest: string) =>
				random() < 0.15 ? `${first}-${first}${rest}` : word,
		);
	}

	if (faces) {
		result = result.replace(/([.!?])(\s|$)/g, (match, mark: string, space: string) =>
			random() < 0.35
				? `${mark} ${FACES[Math.floor(random() * FACES.length)]}${space}`
				: match,
		);
	}

	return result;
}

/**
 * @description Turns text into uwu speak: r and l become w, n before a vowel becomes ny, some words get their uwu form,
 * and optionally some words stutter and some sentences end in a face. Code, links, mentions, channels, timestamps and
 * custom emoji are left as they are. The same text always comes out the same.
 * @param text The text.
 * @param options Whether to stutter and add faces.
 * @returns The uwu text.
 */
export function uwuify(text: string, options: UwuOptions): string {
	const random = seeded(text);

	return text
		.split(PROTECTED)
		.map((part, index) => (index % 2 ? part : uwuifyPlain(part, options, random)))
		.join('');
}
