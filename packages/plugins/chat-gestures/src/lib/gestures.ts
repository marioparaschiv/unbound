export type GestureAction =
	| 'discord'
	| 'replyOrEdit'
	| 'reply'
	| 'react'
	| 'forward'
	| 'save'
	| 'copy'
	| 'delete'
	| 'nothing';

export const TRIPLE_TAP_WINDOW_MS = 500;

type Pending = { messageId: string; timer: ReturnType<typeof setTimeout> };

/**
 * @description Tells a double tap from a triple tap. Discord reports a third tap as a plain tap right after a double tap, so a
 * double tap waits {@link TRIPLE_TAP_WINDOW_MS} for one before it counts.
 * @param schedule Starts a timer, `setTimeout` outside tests.
 * @param cancel Stops a timer, `clearTimeout` outside tests.
 * @returns `doubleTap`, which runs the double tap now or after the wait, and `tap`, which says whether a tap completed a triple tap.
 */
export function createTapCounter(
	schedule: (run: () => void, delay: number) => ReturnType<typeof setTimeout> = setTimeout,
	cancel: (timer: ReturnType<typeof setTimeout>) => void = clearTimeout,
) {
	let pending: Pending | undefined;

	return {
		doubleTap(messageId: string, waitForTriple: boolean, run: () => void): void {
			if (pending) cancel(pending.timer);

			if (!waitForTriple) {
				pending = undefined;
				run();

				return;
			}

			pending = {
				messageId,
				timer: schedule(() => {
					pending = undefined;
					run();
				}, TRIPLE_TAP_WINDOW_MS),
			};
		},
		tap(messageId: string): boolean {
			if (pending?.messageId !== messageId) return false;

			cancel(pending.timer);
			pending = undefined;

			return true;
		},
	};
}

/**
 * @description Reads the reaction emoji setting as the form Discord's reaction endpoint takes.
 * @param emoji A unicode emoji, `<:name:id>`, `<a:name:id>` or `name:id`.
 * @returns The emoji for the endpoint, or `undefined` when the setting is empty.
 */
export function reactionEmoji(emoji: string): string | undefined {
	const trimmed = emoji.trim();

	if (!trimmed) return;

	const custom = /^<?a?:?([\w~]+):(\d{17,20})>?$/.exec(trimmed);

	return custom ? `${custom[1]}:${custom[2]}` : trimmed;
}
