let openName: string | undefined;

/**
 * @description Marks the collection the GIF picker shows in place of the favourites, or none.
 * @param name The collection's name, or `undefined` for the real favourites.
 */
export function setOpenCollection(name: string | undefined): void {
	openName = name;
}

/**
 * @description Reads the collection the GIF picker shows in place of the favourites.
 * @returns Its name, or `undefined`.
 */
export function openCollection(): string | undefined {
	return openName;
}
