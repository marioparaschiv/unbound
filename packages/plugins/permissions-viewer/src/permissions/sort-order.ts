import { SORT_ORDERS, DEFAULT_SORT_ORDER, type SortOrder } from '~/constants';

/**
 * @description Reads the saved role order, falling back to the default for a missing or unknown value.
 * @param value The stored value.
 * @returns A valid sort order.
 */
export function normalizeSortOrder(value: unknown): SortOrder {
	return SORT_ORDERS.find((order) => order === value) ?? DEFAULT_SORT_ORDER;
}

/**
 * @description Flips between starting from the highest and the lowest role.
 * @param order The current order.
 * @returns The other order.
 */
export function toggleSortOrder(order: SortOrder): SortOrder {
	return order === 'highest' ? 'lowest' : 'highest';
}
