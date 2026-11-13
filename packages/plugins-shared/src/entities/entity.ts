/** What a picked id names. */
export type EntityKind = 'user' | 'channel' | 'guild';

/** A user, channel or server as a row draws it. */
export type Entity = {
	kind: EntityKind;
	id: string;
	/** The display name: a user's global name, `#channel`, or the server's name. */
	name: string;
	/** A second line: `@username`, or the channel's server. */
	detail?: string;
	/** An image URL: a user's avatar or a server's icon. */
	image?: string;
	/** An icon asset name, drawn when there is no image. */
	icon?: string;
};

/**
 * @description Tells a Discord id from other text, such as a pasted id from a search.
 * @param text The text.
 * @returns Whether it is a 17 to 20 digit snowflake.
 */
export function isSnowflake(text: string): boolean {
	return /^\d{17,20}$/.test(text);
}

export default { isSnowflake };
