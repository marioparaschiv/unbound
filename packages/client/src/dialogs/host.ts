// How many mounted screens replace the tree that holds Discord's alert host, such as the crash screen.
let holds = 0;

/**
 * @description Sends dialogs to the system alert until the returned release runs, for a screen that unmounts
 * Discord's alert host: an alert opened then would wait unseen until that tree mounts again.
 * @returns Releases the hold.
 */
export function holdSystemDialogs(): () => void {
	holds += 1;

	let released = false;

	return () => {
		if (released) return;

		released = true;
		holds -= 1;
	};
}

/**
 * @description Reports whether a screen that unmounts Discord's alert host is showing.
 * @returns Whether dialogs must use the system alert.
 */
export function systemDialogsHeld(): boolean {
	return holds > 0;
}
