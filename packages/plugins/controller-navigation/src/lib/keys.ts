export type ControllerAction =
	| 'previousChannel'
	| 'nextChannel'
	| 'previousServer'
	| 'nextServer'
	| 'previousUnread'
	| 'nextUnread'
	| 'focusInput'
	| 'markRead';

export const KEY_ACTIONS: Readonly<Record<number, ControllerAction>> = {
	19: 'previousChannel',
	20: 'nextChannel',
	21: 'previousServer',
	22: 'nextServer',
	102: 'previousUnread',
	103: 'nextUnread',
	96: 'focusInput',
	100: 'markRead',
};

export const GAMEPAD_SOURCES = 0x401 | 0x201 | 0x1000010;

/**
 * @description Steps through a list from an item, wrapping at either end.
 * @template T The items.
 * @param items The list.
 * @param current The item now selected, or `undefined` to start at the first or last.
 * @param step `1` for the next item, `-1` for the previous one.
 * @param accept Which items can be stepped to.
 * @returns The next acceptable item, or `undefined` when there is none other than the current one.
 */
export function stepThrough<T>(
	items: readonly T[],
	current: T | undefined,
	step: 1 | -1,
	accept: (item: T) => boolean = () => true,
): T | undefined {
	const start = current === undefined ? -1 : items.indexOf(current);

	for (let offset = 1; offset <= items.length; offset++) {
		const index = (((start + step * offset) % items.length) + items.length) % items.length;
		const item = items[index];

		if (item !== undefined && item !== current && accept(item)) return item;
	}

	return undefined;
}
