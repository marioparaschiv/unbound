import { COLORS, dim, type Span } from './spans';

const CONFLICTING_TWEAKS = new Set(
	[
		'Shadow',
		'A-Bypass',
		'Liberty Lite',
		'KernBypass',
		'FlyJB',
		'Hestia',
		'Enmity',
		'Bunny',
		'Kettu',
		'Vendetta',
		'Pyoncord',
		'Revenge',
	].map((name) => name.toLowerCase()),
);

/**
 * @description Tells whether a tweak is known to break Unbound, such as one that blocks injection or another Discord mod.
 * @param name The tweak's name.
 * @returns Whether it conflicts.
 */
export function isConflictingTweak(name: string): boolean {
	return CONFLICTING_TWEAKS.has(name.trim().toLowerCase());
}

/**
 * @description Lists every tweak for the card, conflicting ones in red and the rest in yellow, conflicts first.
 * @param tweaks The tweak names.
 * @returns The spans.
 */
export function tweakSpans(tweaks: string[]): Span[] {
	const ordered = [...tweaks].sort(
		(a, b) => Number(isConflictingTweak(b)) - Number(isConflictingTweak(a)),
	);

	return ordered.flatMap((name, index) => [
		...(index ? [dim(' · ')] : []),
		{ text: name, color: isConflictingTweak(name) ? COLORS.bad : COLORS.warn },
	]);
}
