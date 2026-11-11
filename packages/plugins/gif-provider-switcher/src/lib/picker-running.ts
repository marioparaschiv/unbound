import createRunningFlag from '@unbound-plugins/shared/react/running-flag';

/** Whether the provider button shows, so a header already on screen drops it once the plugin stops. */
export const PickerRunning = createRunningFlag(addon.id);

let markStopped: (() => void) | undefined;

/**
 * @description Marks the picker running, which shows the provider button in every header on screen.
 */
export function markPickerRunning(): void {
	markStopped = PickerRunning.markRunning();
}

/**
 * @description Marks the picker stopped, which hides the provider button from a header already on screen.
 */
export function markPickerStopped(): void {
	markStopped?.();
	markStopped = undefined;
}
