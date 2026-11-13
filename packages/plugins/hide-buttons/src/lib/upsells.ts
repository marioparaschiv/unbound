type IconComponent = { displayName?: string; name?: string };

/** The guild action row Discord shows for Server Boosts. */
export const SERVER_BOOSTS_ROW = 'guild-boosts';

/**
 * @description Names the icon a You screen button draws, which tells the buttons apart in every language.
 * @param icon The button's `IconComponent`.
 * @returns Its name, such as `QuestsIcon`, or `undefined` when it has none.
 */
export function iconName(icon: unknown): string | undefined {
	if (typeof icon !== 'function' && (typeof icon !== 'object' || icon === null)) return undefined;

	const { displayName, name } = icon as IconComponent;

	return displayName || name || undefined;
}

/**
 * @description Drops hidden rows from the guild action rows Discord builds for the top of a channel list.
 * @param rows The row ids, such as `guild-boosts`.
 * @param hidden The row ids to drop.
 * @returns The rows left, or the same array when nothing is dropped.
 */
export function withoutRows<T>(rows: T, hidden: ReadonlySet<string>): T {
	if (!Array.isArray(rows) || !hidden.size) return rows;

	const kept = rows.filter((row) => !(typeof row === 'string' && hidden.has(row)));

	return (kept.length === rows.length ? rows : kept) as T;
}

export default { SERVER_BOOSTS_ROW, iconName, withoutRows };
