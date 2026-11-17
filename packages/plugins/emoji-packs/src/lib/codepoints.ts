const VARIATION_SELECTOR = 'fe0f';
const ZERO_WIDTH_JOINER = '200d';

/**
 * @description Splits an emoji into its code points, as lowercase hex.
 * @param surrogates The emoji.
 * @returns Its code points.
 */
export function codepoints(surrogates: string): string[] {
	'worklet';

	return Array.from(surrogates, (character) => (character.codePointAt(0) ?? 0).toString(16));
}

/**
 * @description Whether the code points spell a flag: a pair of regional indicators, or a black flag with tag letters.
 * @param points The emoji's code points.
 * @returns Whether it is a flag.
 */
export function isFlag(points: string[]): boolean {
	'worklet';
	const first = parseInt(points[0] ?? '0', 16);

	return (first >= 0x1f1e6 && first <= 0x1f1ff) || (first === 0x1f3f4 && points.length > 2);
}

/**
 * @description Writes code points in a pack's coverage notation: joiners as `+`, variation selectors as `!`.
 * @param points The emoji's code points.
 * @returns The coverage key.
 */
export function coverageKey(points: string[]): string {
	'worklet';
	let key = '';

	for (const point of points) {
		if (point === ZERO_WIDTH_JOINER) key += '+';
		else if (point === VARIATION_SELECTOR) key += '!';
		else key += key === '' || key.endsWith('+') ? point : `-${point}`;
	}

	return key;
}

/**
 * @description Pads each code point to four digits, as file names of most packs do.
 * @param points The emoji's code points.
 * @returns The padded code points.
 */
export function padded(points: string[]): string[] {
	'worklet';

	return points.map((point) => point.padStart(4, '0'));
}

/**
 * @description Drops the variation selectors some packs leave out of their file names.
 * @param points The emoji's code points.
 * @returns The code points without them.
 */
export function withoutVariation(points: string[]): string[] {
	'worklet';

	return points.filter((point) => point !== VARIATION_SELECTOR);
}
