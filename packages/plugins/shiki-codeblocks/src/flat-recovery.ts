export type ForegroundSubscription = (listener: () => void) => () => void;

export type FlatRecovery<T> = {
	mark(item: T, flat: boolean): void;
	dispose(): void;
};

export const FLAT_RECOVERY_INTERVAL_MS = 30_000;

/**
 * @description Repaints code cards that were left without highlighting, every interval and whenever the app returns to the foreground, until each one highlights.
 * @param repaint Repaints one card.
 * @param onForeground Subscribes to the app returning to the foreground.
 * @param intervalMs How often to repaint while a card is still flat.
 * @returns `mark` records whether a card highlighted, `dispose` stops repainting.
 */
export function createFlatRecovery<T>(
	repaint: (item: T) => void,
	onForeground: ForegroundSubscription,
	intervalMs = FLAT_RECOVERY_INTERVAL_MS,
): FlatRecovery<T> {
	const flat = new Set<T>();
	let timer: ReturnType<typeof setInterval> | null = null;
	let unsubscribe: (() => void) | null = null;

	function repaintAll() {
		for (const item of [...flat]) repaint(item);
	}

	function watch() {
		if (timer) return;

		timer = setInterval(repaintAll, intervalMs);
		unsubscribe = onForeground(repaintAll);
	}

	function unwatch() {
		if (timer) clearInterval(timer);

		unsubscribe?.();
		timer = null;
		unsubscribe = null;
	}

	return {
		mark(item, isFlat) {
			if (isFlat) {
				flat.add(item);
				watch();

				return;
			}

			flat.delete(item);

			if (!flat.size) unwatch();
		},
		dispose() {
			flat.clear();
			unwatch();
		},
	};
}

export default { createFlatRecovery };
