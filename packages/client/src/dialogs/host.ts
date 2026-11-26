// Screens mounting their own copy of Discord's alert host because they unmount Discord's, such as the crash screen.
let holds = 0;
let failed = false;
// What reopens each dialog shown in that copy as a system alert, should the copy fail to render.
const fallbacks = new Set<() => void>();

/**
 * @description Marks a screen as hosting Discord's alerts itself until the returned release runs, for a screen that
 * unmounts Discord's alert host: an alert opened there would wait unseen until that tree mounts again.
 * @returns Releases the hold.
 */
export function holdDialogHost(): () => void {
	holds += 1;

	let released = false;

	return () => {
		if (released) return;

		released = true;
		holds -= 1;

		if (holds === 0) {
			failed = false;
			fallbacks.clear();
		}
	};
}

/**
 * @description Reports whether a screen's copy of Discord's alert host failed, so dialogs must use the system alert.
 * @returns Whether dialogs must use the system alert.
 */
export function dialogHostFailed(): boolean {
	return holds > 0 && failed;
}

/**
 * @description Registers what reopens a dialog as a system alert if a screen's copy of the alert host fails to render.
 * Does nothing while no screen hosts alerts.
 * @param fallback Reopens the dialog; it must do nothing once the dialog is closed.
 */
export function onDialogHostFailure(fallback: () => void): void {
	if (holds > 0) {
		fallbacks.add(fallback);
	}
}

/**
 * @description Records that a screen's copy of the alert host failed to render, and reopens its dialogs as system alerts.
 */
export function failDialogHost(): void {
	failed = true;

	for (const fallback of fallbacks) {
		fallback();
	}

	fallbacks.clear();
}
