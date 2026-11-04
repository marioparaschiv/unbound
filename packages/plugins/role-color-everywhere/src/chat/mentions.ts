/**
 * @description Lists the users a message's raw content mentions, in order.
 * @param content The message's raw content, with mentions as `<@id>` or `<@!id>`.
 * @returns The mentioned user IDs.
 */
export function mentionedUserIds(content: string): string[] {
	return Array.from(content.matchAll(/<@!?(\d+)>/g), (match) => match[1]);
}

/**
 * @description Finds which name an `@` mention at a position spells out, trying the longest names first.
 * @param text The text holding the mention.
 * @param at The index of the mention's `@`.
 * @param names The names to try, sorted longest first.
 * @param boundary Matches a character that may follow a complete mention.
 * @returns The matched name without the `@`, or `undefined` when none fits.
 */
export function matchMention(
	text: string,
	at: number,
	names: string[],
	boundary: RegExp,
): string | undefined {
	return names.find((name) => {
		if (!text.startsWith(`@${name}`, at)) return false;

		const next = text[at + name.length + 1];

		return !next || boundary.test(next);
	});
}

/**
 * @description Sorts names longest first, so a mention of `@Ann Lee` is not matched as `@Ann`.
 * @param names The names to sort.
 * @returns A new, sorted array.
 */
export function longestFirst(names: Iterable<string>): string[] {
	return [...names].sort((a, b) => b.length - a.length);
}

export default { mentionedUserIds, matchMention, longestFirst };
