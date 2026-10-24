/**
 * @description Counts the Moyai emoji in a message, Unicode and custom (static or animated) alike.
 * @param content The message content.
 * @returns How many Moyai the message contains.
 */
export function countMoyai(content: string): number {
	return content.match(/🗿|<a?:.*?moy?ai.*?:\d+>/gi)?.length ?? 0;
}

/**
 * @description Checks whether a reaction's emoji name is a Moyai.
 * @param name The reaction emoji's name.
 * @returns `true` for the Unicode Moyai or a custom emoji named like one.
 */
export function isMoyaiReaction(name: string): boolean {
	return name === '🗿' || /moy?ai/i.test(name);
}
