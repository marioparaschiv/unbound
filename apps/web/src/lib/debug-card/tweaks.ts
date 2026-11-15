import { COLORS, dim, type Span } from './spans';

const CONFLICTING_TWEAKS = new Set(
	[
		'Choicy',
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
 * @description Lists tweaks for the card, conflicting ones in red and the rest in yellow, conflicts first, fitted to the room.
 * @param tweaks The tweak names.
 * @param room How many characters fit.
 * @returns The spans.
 */
export function tweakSpans(tweaks: string[], room: number): Span[] {
	const ordered = [...tweaks].sort(
		(a, b) => Number(isConflictingTweak(b)) - Number(isConflictingTweak(a)),
	);
	const spans: Span[] = [];
	let used = 0;

	for (const [index, name] of ordered.entries()) {
		const separator = index ? 3 : 0;
		const left = ordered.length - index - 1;
		const more = left ? ` · +${left} more` : '';

		if (used + separator + name.length + (left ? more.length : 0) > room && index > 0) {
			spans.push(dim(` · +${ordered.length - index} more`));
			break;
		}

		if (index) spans.push(dim(' · '));

		spans.push({ text: name, color: isConflictingTweak(name) ? COLORS.bad : COLORS.warn });
		used += separator + name.length;
	}

	return spans;
}
