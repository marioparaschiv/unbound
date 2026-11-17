import { settings } from '@unbound-app/settings';

/**
 * @description Forgets the average and best typing speed.
 */
export function resetStats(): void {
	settings.messages = 0;
	settings.totalWpm = 0;
	settings.bestWpm = 0;
}
