/** The start of 2015 in Unix milliseconds: the zero point of Discord snowflake timestamps. */
export const DISCORD_EPOCH = 1_420_070_400_000n;

/** The only remote host the bot token may be sent to. */
export const DISCORD_API_HOST = 'discord.com';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * @description Reads the creation time encoded in a Discord snowflake id.
 * @param id The snowflake, e.g. a Discord user id.
 * @returns When the object the id belongs to was created.
 */
export function getSnowflakeDate(id: string): Date {
	return new Date(Number((BigInt(id) >> 22n) + DISCORD_EPOCH));
}

/**
 * @description Builds the URL of a Discord user's uploaded avatar, animated when the hash says so.
 * @param id The user's id.
 * @param hash The avatar hash.
 * @returns The CDN URL.
 */
export function getAvatarUrl(id: string, hash: string): string {
	const format = hash.startsWith('a_') ? 'gif' : 'png';

	return `https://cdn.discordapp.com/avatars/${id}/${hash}.${format}`;
}

/**
 * @description Builds the URL of the default avatar Discord shows for a user without one.
 * @param id The user's id; `'0'` gives the first default avatar.
 * @returns The CDN URL.
 */
export function getDefaultAvatarUrl(id: string): string {
	return `https://cdn.discordapp.com/embed/avatars/${(BigInt(id) >> 22n) % 6n}.png`;
}

/**
 * @description Decides whether a URL may receive the Discord bot token: `https://discord.com`, or a
 * loopback address for tests and local runs.
 * @param url The URL a request would go to.
 * @returns Whether the token may be sent there.
 */
export function isBotTokenHost(url: URL): boolean {
	if (LOOPBACK_HOSTS.has(url.hostname)) {
		return url.protocol === 'http:' || url.protocol === 'https:';
	}

	return url.protocol === 'https:' && url.host === DISCORD_API_HOST;
}

export default {
	DISCORD_EPOCH,
	DISCORD_API_HOST,
	getSnowflakeDate,
	getAvatarUrl,
	getDefaultAvatarUrl,
	isBotTokenHost,
};
