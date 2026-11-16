import type { storage } from '@unbound-app/api';

type StoredValue = Parameters<ReturnType<typeof storage.getBucket>['set']>[1];

export type SavedHit = { id: string; channel_id: string; [key: string]: StoredValue };

export type HitPage = {
	ids: string[];
	isAfter: boolean;
	hasMore: boolean;
};

export type PageOptions = {
	guildOf: (channelId: string) => string | null | undefined;
	guildId?: string | null;
	listOldestId?: string;
	isIgnored?: (message: SavedHit) => boolean;
};

function isSavedHit(value: unknown): value is SavedHit {
	const entry = value as Partial<SavedHit> | null;

	return typeof entry?.id === 'string' && typeof entry.channel_id === 'string';
}

/**
 * @description Orders by snowflake, newest first.
 * @param a One entry.
 * @param b The other.
 * @returns A sort comparison.
 */
export function newestFirst(a: { id: string }, b: { id: string }): number {
	const difference = BigInt(b.id) - BigInt(a.id);

	return difference > 0n ? 1 : difference < 0n ? -1 : 0;
}

function isNewer(id: string, than: string): boolean {
	return BigInt(id) > BigInt(than);
}

/**
 * @description Reads saved keyword hits, dropping anything malformed.
 * @param value What storage held.
 * @returns The hits, newest first.
 */
export function parseSavedHits(value: unknown): SavedHit[] {
	return Array.isArray(value) ? value.filter(isSavedHit).sort(newestFirst) : [];
}

/**
 * @description Adds a keyword hit, replacing an older copy of the same message and keeping the newest `limit`.
 * @param list The saved hits.
 * @param message The message that matched a keyword.
 * @param limit How many hits to keep.
 * @returns The new list, newest first.
 */
export function rememberHit(list: SavedHit[], message: SavedHit, limit: number): SavedHit[] {
	return [message, ...list.filter((entry) => entry.id !== message.id)]
		.sort(newestFirst)
		.slice(0, limit);
}

/**
 * @description Removes a hit, as when it is dismissed from the inbox or deleted.
 * @param list The saved hits.
 * @param messageId The message to forget.
 * @returns The list without it.
 */
export function forgetHit(list: SavedHit[], messageId: string): SavedHit[] {
	return list.filter((entry) => entry.id !== messageId);
}

/**
 * @description Picks the saved hits that belong in a page Discord loaded: newer than the page's oldest entry, older
 * than what the list already shows, not already on the page, in the filtered server, and not ignored.
 * @param page The page's ids, newest first, whether it extends the list, and whether more pages follow.
 * @param hits The saved hits, newest first.
 * @param options How to find a channel's server, the server filter, the list's oldest entry and what is ignored.
 * @returns The fitting hits, newest first.
 */
export function hitsForPage(
	{ ids, isAfter, hasMore }: HitPage,
	hits: SavedHit[],
	{ guildOf, guildId, listOldestId, isIgnored }: PageOptions,
): SavedHit[] {
	const upper = isAfter ? listOldestId : undefined;
	const lower = hasMore ? ids.at(-1) : undefined;

	if (hasMore && !lower) return [];

	const present = new Set(ids);

	return hits.filter(
		(hit) =>
			!present.has(hit.id) &&
			(!upper || isNewer(upper, hit.id)) &&
			(!lower || isNewer(hit.id, lower)) &&
			(!guildId || guildOf(hit.channel_id) === guildId) &&
			!isIgnored?.(hit),
	);
}

export default { parseSavedHits, rememberHit, forgetHit, hitsForPage, newestFirst };
