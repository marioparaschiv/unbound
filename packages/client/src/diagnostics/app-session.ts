import { AppState } from 'react-native';

/** How long Discord has run and how often it went to the background since. */
export type AppSession = { uptimeS: number; backgrounded: number };

let startedAt = Date.now();
let backgrounded = 0;
let subscription: ReturnType<typeof AppState.addEventListener> | undefined;

/**
 * @description Starts counting how often Discord goes to the background, from now.
 */
export function startAppSession(): void {
	startedAt = Date.now();
	backgrounded = 0;
	subscription?.remove();
	subscription = AppState.addEventListener('change', (state) => {
		if (state === 'background') {
			backgrounded += 1;
		}
	});
}

/**
 * @description Stops counting background transitions.
 */
export function stopAppSession(): void {
	subscription?.remove();
	subscription = undefined;
}

/**
 * @description Reads how long Discord has run since Unbound started and how often it went to the background.
 * @returns Seconds of uptime and the background count.
 */
export function readAppSession(): AppSession {
	return { uptimeS: Math.round((Date.now() - startedAt) / 1000), backgrounded };
}

export default { startAppSession, stopAppSession, readAppSession };
