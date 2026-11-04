/**
 * @description Names what tapping the toggle does, as Vencord's tooltip does.
 * @param active Whether the next message is sent silently.
 * @returns The accessibility label.
 */
export function toggleLabel(active: boolean): string {
	return active ? 'Disable Silent Message' : 'Enable Silent Message';
}

/**
 * @description Describes the toggle's new state after a tap.
 * @param enabled Whether the toggle is now on.
 * @returns The toast text.
 */
export function toggledMessage(enabled: boolean): string {
	return enabled
		? 'Your messages here are sent without notifications.'
		: 'Your messages here notify people again.';
}
