import { settings } from '@unbound-app/settings';

/** Puts the accent back to its default. */
export function resetAccent() {
	settings.appearance.accent = '#5865f2';
}
