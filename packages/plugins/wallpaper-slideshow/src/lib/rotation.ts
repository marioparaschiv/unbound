/**
 * @description Picks the next wallpaper's position: the following one, wrapping, or with `shuffle` a random one other
 * than the current.
 * @param position The current position.
 * @param count How many wallpapers there are.
 * @param shuffle Whether to pick at random.
 * @param random A number in [0, 1).
 * @returns The next position, or `0` for an empty list.
 */
export function nextPosition(
	position: number,
	count: number,
	shuffle: boolean,
	random: number,
): number {
	if (count <= 1) return 0;

	if (!shuffle) return (position + 1) % count;

	const offset = 1 + Math.floor(random * (count - 1));

	return (position + offset) % count;
}

/**
 * @description Keeps only links a chat background can load.
 * @param links The links the user entered.
 * @returns The http and https links, trimmed.
 */
export function usableLinks(links: readonly string[]): string[] {
	return links.map((link) => link.trim()).filter((link) => /^https?:\/\/\S+$/i.test(link));
}
