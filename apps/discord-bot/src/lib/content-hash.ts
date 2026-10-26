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
 * @description Hashes an addon listing so an unchanged one compares equal. The hashes posted under the
 * old feed used the same serialization, so a listing that did not change still matches its post.
 * @param addon The addon's public listing.
 * @returns The sha256 hex of the listing serialized with sorted keys.
 */
export function contentHash(addon: PublicAddon): string {
	const serialized = JSON.stringify(sortKeys(addon));

	return new Bun.CryptoHasher('sha256').update(serialized).digest('hex');
}

export default { contentHash };
