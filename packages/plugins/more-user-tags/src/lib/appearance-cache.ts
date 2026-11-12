import { storage } from '@unbound-app/api';

import { labelAppearances } from '~/lib/label-appearances';

const APPEARANCE_CACHE_KEY = 'appearanceCache';
const SAVE_DELAY_MS = 1000;

// Holds the cached tag colors, which are data, not a setting.
const bucket = storage.getBucket();

let stopSaving: (() => void) | undefined;

/**
 * @description Restores the tag colors saved last time, then saves them a moment after they change, so the native
 * gradients can draw before the first tag renders.
 */
export function startSavingAppearances(): void {
	let saveTimer: ReturnType<typeof setTimeout> | undefined;

	// Starts from the saved colors alone, as on a fresh evaluation of the bundle.
	labelAppearances.clear();
	labelAppearances.restore(bucket.get(APPEARANCE_CACHE_KEY, {}));

	const unsubscribe = labelAppearances.subscribe(() => {
		saveTimer ??= setTimeout(() => {
			saveTimer = undefined;
			bucket.set(APPEARANCE_CACHE_KEY, labelAppearances.snapshot());
		}, SAVE_DELAY_MS);
	});

	stopSaving = () => {
		unsubscribe();
		clearTimeout(saveTimer);
	};
}

/**
 * @description Stops saving the tag colors and cancels a pending save.
 */
export function stopSavingAppearances(): void {
	stopSaving?.();
	stopSaving = undefined;
}
