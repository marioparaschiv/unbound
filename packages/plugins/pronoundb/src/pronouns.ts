import { PronounLabels, SENTENCE_CODES } from '~/constants';

/**
 * @description Turns PronounDB's pronoun codes into the label shown next to a message.
 * @param codes The user's English pronoun set from PronounDB, such as `['he', 'they']`.
 * @param capitalized Whether pronouns such as `He/Him` keep their capitals.
 * @returns The label, or `null` when the user has no pronouns set.
 */
export function formatPronouns(codes: string[] | undefined, capitalized: boolean): string | null {
	if (!codes?.length) return null;

	if (codes.length > 1) {
		const pronouns = codes
			.map((code) => code.charAt(0).toUpperCase() + code.slice(1))
			.join('/');

		return capitalized ? pronouns : pronouns.toLowerCase();
	}

	const [code] = codes;
	const label = PronounLabels[code] ?? code;

	return capitalized || SENTENCE_CODES.includes(code) ? label : label.toLowerCase();
}

/**
 * @description Cleans the free-text pronouns field of a Discord profile.
 * @param pronouns The profile's `pronouns` field.
 * @returns The pronouns on one line, or `undefined` when the field is empty.
 */
export function cleanProfilePronouns(pronouns: string | undefined): string | undefined {
	return pronouns?.trim().replace(/\n+/g, '') || undefined;
}

/**
 * @description Picks which source's pronouns to show, falling back to the other source.
 * @param discord The pronouns from the user's Discord profile.
 * @param pronounDB The pronouns from PronounDB.
 * @param preferDiscord Whether Discord's pronouns win over PronounDB's.
 * @returns The pronouns to show, or `null` when neither source has any.
 */
export function pickPronouns(
	discord: string | undefined,
	pronounDB: string | null,
	preferDiscord: boolean,
): string | null {
	return (preferDiscord ? discord || pronounDB : pronounDB || discord) || null;
}

/**
 * @description Shortens pronouns to fit the message header, keeping only the first `|` or `•` separated part.
 * @param pronouns The full pronouns.
 * @returns At most 12 characters, ending in `…` when cut.
 */
export function shortenPronouns(pronouns: string): string {
	const [first] = pronouns.split(/\s+[|•]\s+/);
	const label = first.trim();

	if (label.length <= 12) return label;

	return `${label.slice(0, 11).trimEnd()}…`;
}
