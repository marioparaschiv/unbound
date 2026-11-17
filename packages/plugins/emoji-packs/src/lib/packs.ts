import {
	codepoints,
	coverageKey,
	isFlag,
	padded,
	toneTemplate,
	withoutVariation,
} from '~/lib/codepoints';
import { FLUENT_BASE, NOTO_ANIMATED_BASE, NOTO_BASE } from '~/lib/sources';

export type PackId = 'fluent-animated' | 'fluent' | 'noto-animated' | 'noto';

export type Coverage = {
	fluentAnimated: string;
	fluentStill: string;
	notoAnimated: string;
};

export type CoverageSets = { [K in keyof Coverage]: Set<string> };

/**
 * @description Reads each coverage list into a set.
 * @param coverage The space-separated lists from coverage.json.
 * @returns The sets.
 */
export function coverageSets(coverage: Coverage): CoverageSets {
	'worklet';

	return {
		fluentAnimated: new Set(coverage.fluentAnimated.split(' ')),
		fluentStill: new Set(coverage.fluentStill.split(' ')),
		notoAnimated: new Set(coverage.notoAnimated.split(' ')),
	};
}

function covers(set: Set<string>, key: string): boolean {
	'worklet';

	return set.has(key) || set.has(toneTemplate(key));
}

function fluentUrl(points: string[], sets: CoverageSets, animated: boolean): string | undefined {
	'worklet';
	const key = coverageKey(points);
	const file = `${points.join('-')}.png`;

	if (covers(sets.fluentAnimated, key)) {
		return `${FLUENT_BASE}/${animated ? 'animated-static' : 'static'}/${file}`;
	}

	return covers(sets.fluentStill, key) ? `${FLUENT_BASE}/static/${file}` : undefined;
}

function notoUrl(points: string[], sets: CoverageSets, animated: boolean): string | undefined {
	'worklet';

	if (isFlag(points)) return undefined;

	if (animated && covers(sets.notoAnimated, coverageKey(points))) {
		return `${NOTO_ANIMATED_BASE}/${points.join('_')}/512.webp`;
	}

	return `${NOTO_BASE}/emoji_u${padded(withoutVariation(points)).join('_')}.png`;
}

/**
 * @description The image a pack draws for an emoji.
 * @param pack The chosen pack.
 * @param surrogates The emoji.
 * @param sets The packs' coverage, from `coverageSets`.
 * @returns The image URL, or `undefined` when the pack lacks the emoji and Discord's own should stay.
 */
export function packUrl(pack: PackId, surrogates: string, sets: CoverageSets): string | undefined {
	'worklet';
	const points = codepoints(surrogates);

	if (points.length === 0) return undefined;

	if (pack === 'fluent-animated' || pack === 'fluent') {
		return fluentUrl(points, sets, pack === 'fluent-animated');
	}

	return notoUrl(points, sets, pack === 'noto-animated');
}
