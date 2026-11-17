const SKIN_TONES = ['1f3fb', '1f3fc', '1f3fd', '1f3fe', '1f3ff'];

export type Coverage = {
	fluent: string;
	fluentMoving: string;
	notoMoving: string;
};

export type CoverageSets = {
	fluent: Set<string>;
	fluentMoving: Set<string>;
	notoMoving: Set<string>;
};

function expandTemplate(template: string): string[] {
	'worklet';
	const at = template.indexOf('T');

	if (at === -1) return [template];

	return SKIN_TONES.flatMap((tone) =>
		expandTemplate(`${template.slice(0, at)}${tone}${template.slice(at + 1)}`),
	);
}

/**
 * @description Expands a coverage list, whose `T` stands for each of the five skin tones, into its sorted keys.
 * @param list The space-separated list.
 * @returns Every key it covers, sorted.
 */
export function expandCoverage(list: string): string[] {
	'worklet';

	return list
		.split(' ')
		.filter((entry) => entry !== '')
		.flatMap(expandTemplate)
		.sort();
}

/**
 * @description Picks the keys a hex bitmap marks, bit `i` standing for `keys[i]`, highest bit of each digit first.
 * @param keys The keys, in bitmap order.
 * @param bitmap The hex digits.
 * @returns The marked keys.
 */
export function markedKeys(keys: string[], bitmap: string): string[] {
	'worklet';

	return keys.filter((_, index) => {
		const digit = parseInt(bitmap[index >> 2] ?? '0', 16);

		return Boolean(digit & (8 >> (index & 3)));
	});
}

/**
 * @description Reads coverage.json into sets: Fluent's emoji, the ones Fluent animated, and the ones Noto animated.
 * @param coverage The lists from coverage.json.
 * @returns The sets.
 */
export function coverageSets(coverage: Coverage): CoverageSets {
	'worklet';
	const fluent = expandCoverage(coverage.fluent);

	return {
		fluent: new Set(fluent),
		fluentMoving: new Set(markedKeys(fluent, coverage.fluentMoving)),
		notoMoving: new Set(expandCoverage(coverage.notoMoving)),
	};
}
