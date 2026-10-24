/**
 * @description Picks the first `prefix` + index name that React Native has not registered yet.
 * @param prefix The surface's name prefix.
 * @param registered The app keys already registered.
 * @returns The free name.
 */
export function nextSurfaceName(prefix: string, registered: readonly string[]): string {
	let index = 0;

	while (registered.includes(`${prefix}${index}`)) index++;

	return `${prefix}${index}`;
}

export default nextSurfaceName;
