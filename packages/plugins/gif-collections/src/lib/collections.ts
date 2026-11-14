/** A GIF as Discord's favourites keep it. */
export type Gif = { url: string; src: string; width: number; height: number; format: number };

/** A named list of GIFs. */
export type Collection = { name: string; gifs: Gif[] };

const MAX_NAME = 32;

function isGif(value: unknown): value is Gif {
	const gif = value as Partial<Gif> | null;

	return (
		typeof gif?.url === 'string' &&
		typeof gif.src === 'string' &&
		typeof gif.width === 'number' &&
		typeof gif.height === 'number' &&
		typeof gif.format === 'number'
	);
}

/**
 * @description Reads stored collections, dropping anything malformed.
 * @param value What storage holds.
 * @returns The collections.
 */
// UNKNOWN: storage may hold anything an older or broken version wrote.
export function parseCollections(value: unknown): Collection[] {
	if (!Array.isArray(value)) return [];

	return value.flatMap((entry) => {
		const collection = entry as Partial<Collection> | null;

		if (typeof collection?.name !== 'string' || !Array.isArray(collection.gifs)) return [];

		return [{ name: collection.name, gifs: collection.gifs.filter(isGif) }];
	});
}

/**
 * @description Tidies a collection name: trimmed, single spaces, at most 32 characters.
 * @param name What was typed.
 * @returns The name, or `undefined` when nothing is left.
 */
export function cleanName(name: string): string | undefined {
	const cleaned = name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME);

	return cleaned || undefined;
}

/**
 * @description Finds a collection by name, ignoring case.
 * @param collections The collections.
 * @param name The name.
 * @returns The collection, or `undefined`.
 */
export function findCollection(collections: Collection[], name: string): Collection | undefined {
	const key = name.toLowerCase();

	return collections.find((collection) => collection.name.toLowerCase() === key);
}

/**
 * @description Tells whether a collection holds a GIF.
 * @param collection The collection.
 * @param gif The GIF.
 * @returns Whether it is in there.
 */
export function holds(collection: Collection, gif: Gif): boolean {
	return collection.gifs.some((entry) => entry.url === gif.url);
}

/**
 * @description Adds a GIF to a collection, or takes it out when it is already there; newest first.
 * @param collections The collections.
 * @param name The collection's name.
 * @param gif The GIF.
 * @returns The new collections.
 */
export function toggleGif(collections: Collection[], name: string, gif: Gif): Collection[] {
	return collections.map((collection) => {
		if (collection !== findCollection(collections, name)) return collection;

		return holds(collection, gif)
			? { ...collection, gifs: collection.gifs.filter((entry) => entry.url !== gif.url) }
			: { ...collection, gifs: [gif, ...collection.gifs] };
	});
}

/**
 * @description Creates a collection, holding a GIF when one is given; a taken name adds the GIF to that collection instead.
 * @param collections The collections.
 * @param name The new name, as typed.
 * @param gif The GIF to start it with.
 * @returns The new collections, or the same ones when the name is empty.
 */
export function createCollection(collections: Collection[], name: string, gif?: Gif): Collection[] {
	const cleaned = cleanName(name);

	if (!cleaned) return collections;

	const existing = findCollection(collections, cleaned);

	if (existing)
		return gif && !holds(existing, gif) ? toggleGif(collections, cleaned, gif) : collections;

	return [...collections, { name: cleaned, gifs: gif ? [gif] : [] }];
}

/**
 * @description Deletes a collection.
 * @param collections The collections.
 * @param name Its name.
 * @returns The collections without it.
 */
export function deleteCollection(collections: Collection[], name: string): Collection[] {
	const target = findCollection(collections, name);

	return collections.filter((collection) => collection !== target);
}
