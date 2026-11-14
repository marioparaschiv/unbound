import { formatIdList, parseIdList } from '@unbound-plugins/shared/entities/id-list';

/** A favorite channel as Discord's `FavoriteStore` lists it. */
export type Favorite = {
	id: string;
	nickname: string | null;
	type: number;
	channelType: number;
	order: number;
	parentId: string | null;
};

const CHANNEL_FAVORITE = 1;
const LOCAL_ORDER = 1e6;

/**
 * @description Adds this device's favorite channels to the ones Discord stores on the account, after them.
 * @param account The account's favorites.
 * @param local The channel ids kept on this device, in the order they were added.
 * @param channelType Reads a channel's type.
 * @returns The combined favorites.
 */
export function withLocalFavorites(
	account: Record<string, Favorite>,
	local: readonly string[],
	channelType: (id: string) => number,
): Record<string, Favorite> {
	if (!local.length) return account;

	const merged = { ...account };

	local.forEach((id, order) => {
		merged[id] ??= {
			id,
			nickname: null,
			type: CHANNEL_FAVORITE,
			channelType: channelType(id),
			order: LOCAL_ORDER + order,
			parentId: null,
		};
	});

	return merged;
}

/**
 * @description Adds channels to the device's favorites, once each.
 * @param stored The stored id list.
 * @param ids The channels to add.
 * @returns The new stored list.
 */
export function addFavorites(stored: string, ids: readonly string[]): string {
	return formatIdList([...new Set([...parseIdList(stored), ...ids])]);
}

/**
 * @description Removes a channel from the device's favorites.
 * @param stored The stored id list.
 * @param id The channel to remove.
 * @returns The new stored list.
 */
export function removeFavorite(stored: string, id: string): string {
	return formatIdList(parseIdList(stored).filter((favorite) => favorite !== id));
}
