import type { PublicAddon } from '@unbound-app/web/bot';

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
 * @description Hashes an addon listing and the author emojis its card shows, so an unchanged card compares equal.
 * @param addon The addon's public listing.
 * @param authorEmojis The avatar emoji name per author Discord id; a new avatar changes the hash.
 * @returns The sha256 hex of the listing serialized with sorted keys.
 */
export function contentHash(addon: PublicAddon, authorEmojis: Record<string, string> = {}): string {
	// Without avatars the listing hashes alone, as it always has.
	const value = Object.keys(authorEmojis).length > 0 ? { ...addon, authorEmojis } : addon;
	const serialized = JSON.stringify(sortKeys(value));

	return new Bun.CryptoHasher('sha256').update(serialized).digest('hex');
}

export default { contentHash };
