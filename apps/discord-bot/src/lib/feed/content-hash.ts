import type { AddonFeedItem } from '~/lib/feed/types';

type JsonObject = { [key: string]: JsonValue };
// `undefined` stands for an absent optional field; JSON.stringify drops it.
type JsonValue = string | number | boolean | null | undefined | JsonValue[] | JsonObject;

function isJsonObject(value: JsonValue): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sortKeys(value: JsonValue): JsonValue {
	if (Array.isArray(value)) {
		return value.map(sortKeys);
	}

	if (!isJsonObject(value)) {
		return value;
	}

	const keys = Object.keys(value).sort();

	return Object.fromEntries(keys.map((key) => [key, sortKeys(value[key])]));
}

/**
 * @description Hashes an addon snapshot so a re-sent but unchanged listing compares equal.
 * @param item The addon feed item.
 * @returns The sha256 hex of the item serialized with sorted keys, excluding `updatedAt`.
 */
export function contentHash(item: AddonFeedItem): string {
	const { updatedAt: _, ...content } = item;
	const serialized = JSON.stringify(sortKeys(content));

	return new Bun.CryptoHasher('sha256').update(serialized).digest('hex');
}

export default { contentHash };
