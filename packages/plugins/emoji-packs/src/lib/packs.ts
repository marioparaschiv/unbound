import { codepoints, coverageKey, isFlag, padded, withoutVariation } from '~/lib/codepoints';
import type { CoverageSets } from '~/lib/coverage-sets';
import { FLUENT_BASE, FLUENT_MOVING_BASE, NOTO_ANIMATED_BASE, NOTO_BASE } from '~/lib/sources';

export type PackId = 'fluent-animated' | 'fluent' | 'noto-animated' | 'noto';

function fluentUrl(points: string[], sets: CoverageSets, animated: boolean): string | undefined {
	'worklet';
	const key = coverageKey(points);
	const name = points.join('-');

	if (!sets.fluent.has(key)) return undefined;

	if (animated && sets.fluentMoving.has(key)) return `${FLUENT_MOVING_BASE}/${name}.webp`;

	return `${FLUENT_BASE}/static/${name}.png`;
}

function notoUrl(points: string[], sets: CoverageSets, animated: boolean): string | undefined {
	'worklet';

	if (isFlag(points)) return undefined;

	if (animated && sets.notoMoving.has(coverageKey(points))) {
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
