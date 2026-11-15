const SEPARATOR = '\n';

/**
 * @description Reads a stored list of menu option labels.
 * @param value The stored value, one label per line.
 * @returns The labels.
 */
export function parseLabels(value: string): string[] {
	return value.split(SEPARATOR).filter(Boolean);
}

/**
 * @description Stores a list of menu option labels.
 * @param labels The labels.
 * @returns One label per line.
 */
export function formatLabels(labels: readonly string[]): string {
	return labels.join(SEPARATOR);
}

/**
 * @description Orders a menu's options: the ones the user placed come first in their order, the rest follow in Discord's order, and hidden ones are left out.
 * @param labels The options' labels in Discord's order.
 * @param order The labels the user placed, in their order.
 * @param hidden The labels the user hid.
 * @returns The positions in `labels` to show, in order.
 */
export function orderedPositions(
	labels: readonly string[],
	order: readonly string[],
	hidden: ReadonlySet<string>,
): number[] {
	const rank = new Map(order.map((label, index) => [label, index]));
	const positions = labels
		.map((_, index) => index)
		.filter((index) => !hidden.has(labels[index]!));

	return positions.sort((a, b) => {
		const rankA = rank.get(labels[a]!) ?? Infinity;
		const rankB = rank.get(labels[b]!) ?? Infinity;

		return rankA === rankB ? a - b : rankA - rankB;
	});
}

/**
 * @description Adds options seen in a menu to the remembered ones, keeping the order they were first seen in.
 * @param seen The labels remembered so far.
 * @param labels The labels in the menu just opened.
 * @returns The remembered labels, or `undefined` when nothing is new.
 */
export function withSeen(seen: readonly string[], labels: readonly string[]): string[] | undefined {
	const known = new Set(seen);
	const fresh = labels.filter((label) => !known.has(label));

	return fresh.length ? [...seen, ...new Set(fresh)] : undefined;
}

/**
 * @description Lists every option for the editor: the placed ones in their order, then the other remembered ones.
 * @param order The labels the user placed.
 * @param seen Every label remembered.
 * @returns The labels to edit.
 */
export function editableLabels(order: readonly string[], seen: readonly string[]): string[] {
	const placed = new Set(order);

	return [...order, ...seen.filter((label) => !placed.has(label))];
}

/**
 * @description Moves one option to another place in the list.
 * @param labels The labels in their current order.
 * @param from The option's position.
 * @param to The position it moves to.
 * @returns The new order.
 */
export function moved(labels: readonly string[], from: number, to: number): string[] {
	const next = [...labels];
	const [label] = next.splice(from, 1);

	if (label !== undefined) next.splice(to, 0, label);

	return next;
}
