import type { SortOrder } from '~/constants';

/**
 * @description Flips between starting from the highest and the lowest role.
 * @param order The current order.
 * @returns The other order.
 */
export function toggleSortOrder(order: SortOrder): SortOrder {
	return order === 'highest' ? 'lowest' : 'highest';
}
