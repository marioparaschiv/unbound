/** The fields the Featured pick reads, so the client's catalog entries and the website's rows both fit. */
export type FeaturedCandidate = {
	id: string;
	type: string;
	iconSvg?: string | null;
};

/** A kind with fewer listed addons shows no shelf, since it would only repeat the list below it. */
const FEATURED_MIN_LISTED = 8;
const FEATURED_LIMIT = 10;
const DAY_MS = 86_400_000;

// FNV-1a: a stable, well-spread order for one day's picks without shipping a PRNG.
function hash(text: string): number {
	let value = 2166136261;

	for (let index = 0; index < text.length; index++) {
		value = Math.imul(value ^ text.charCodeAt(index), 16777619);
	}

	return value >>> 0;
}

/**
 * @description Picks the addons the Featured shelf shows: those whose maintainers chose an icon, in an
 * order that changes once a day, so every polished addon gets its turn. The client and website pick alike.
 * @template T The listed addon shape.
 * @param addons The listed addons.
 * @param type The tab's kind.
 * @param now The current time in milliseconds; picks change at midnight UTC.
 * @returns Up to ten addons, or none when the kind lists too few for a shelf to add anything.
 */
export function pickFeatured<T extends FeaturedCandidate>(
	addons: T[],
	type: T['type'],
	now: number,
): T[] {
	const listed = addons.filter((addon) => addon.type === type);

	if (listed.length < FEATURED_MIN_LISTED) {
		return [];
	}

	const day = Math.floor(now / DAY_MS);
	const iconed = listed.filter((addon) => addon.iconSvg);
	const pool = iconed.length >= FEATURED_MIN_LISTED ? iconed : listed;

	return pool
		.map((addon) => ({ addon, rank: hash(`${day}:${addon.id}`) }))
		.sort((a, b) => a.rank - b.rank)
		.slice(0, FEATURED_LIMIT)
		.map(({ addon }) => addon);
}

export default { pickFeatured };
