export type PickerSession = {
	mount(now: number): void;
	unmount(now: number): void;
	pressedByUser(): void;
	claimAutoEnable(isActive: boolean | undefined): boolean;
	reset(): void;
};

/**
 * @description Tracks one open reaction picker across remounts of its Super Reaction toggle, so the toggle is switched on once per picker and never after the user switches it.
 * A picker ends when no toggle has been mounted for the grace period; a toggle that remounts sooner belongs to the same picker.
 * @param graceMs How long, in milliseconds, all toggles can be unmounted before the picker counts as closed.
 * @returns The session.
 */
export function createPickerSession(graceMs: number): PickerSession {
	let mounted = 0;
	let lastUnmountAt = Number.NEGATIVE_INFINITY;
	let userPressed = false;
	let autoEnabled = false;

	function startNewPicker() {
		userPressed = false;
		autoEnabled = false;
	}

	return {
		mount(now) {
			if (mounted === 0 && now - lastUnmountAt >= graceMs) startNewPicker();

			mounted++;
		},
		unmount(now) {
			mounted = Math.max(0, mounted - 1);

			if (mounted === 0) lastUnmountAt = now;
		},
		pressedByUser() {
			userPressed = true;
		},
		claimAutoEnable(isActive) {
			if (isActive || userPressed || autoEnabled) return false;

			autoEnabled = true;

			return true;
		},
		reset() {
			mounted = 0;
			lastUnmountAt = Number.NEGATIVE_INFINITY;
			startNewPicker();
		},
	};
}
