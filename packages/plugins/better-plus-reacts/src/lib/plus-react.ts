/** Matches `+:name:` with any number of pluses, as Discord's own reaction command reads it with one. */
export const PLUS_REACT = /^\++:(.+?): *$/;

/** A plus reaction: which message back it targets and the emoji's name. */
export type PlusReact = { back: number; name: string };

/**
 * @description Reads a plus reaction from a message, counting its pluses.
 * @param content The message text.
 * @returns How many messages back to react, 1 for the last, and the emoji name, or `undefined` when it is not one.
 */
export function parsePlusReact(content: string): PlusReact | undefined {
	const text = content.trim();
	const match = PLUS_REACT.exec(text);
	const back = /^\++/.exec(text)?.[0].length ?? 0;

	return match?.[1] && back ? { back, name: match[1] } : undefined;
}

export default parsePlusReact;
