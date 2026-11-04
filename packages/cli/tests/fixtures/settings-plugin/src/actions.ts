import { settings } from '@unbound-app/settings';

/** @description Empties the word list; the `clearCache` button runs it. */
export function clearCache() {
	settings.words = [];
}

/**
 * @description Puts the style back to cozy; a const arrow is a function export too.
 * @returns Nothing.
 */
export const resetStyle = () => void Object.assign(settings, { style: 'cozy' });
