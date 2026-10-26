/** The start of 2015 in Unix milliseconds: the zero point of Discord snowflake timestamps. */
export const DISCORD_EPOCH = 1_420_070_400_000n;

export const BOT_TOKEN_HOST = 'discord.com';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

const SNOWFLAKE_PATTERN = /^[1-9]\d{0,19}$/;

const SNOWFLAKE_LIMIT = 1n << 64n;

/**
 * @description Reads the creation time encoded in a Discord snowflake id.
 * @param id The snowflake, e.g. a Discord user id.
 * @returns When the object the id belongs to was created.
 */
export function getSnowflakeDate(id: string): Date {
	return new Date(Number((BigInt(id) >> 22n) + DISCORD_EPOCH));
}

/**
 * @description Checks that a manifest author id can name a Discord user, which `'0'` and malformed ids cannot.
 * @param id The manifest author id.
 * @returns Whether the id is a snowflake worth looking up.
 */
export function isDiscordId(id: string): boolean {
	return SNOWFLAKE_PATTERN.test(id) && BigInt(id) < SNOWFLAKE_LIMIT;
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
 * @description Decides whether a URL may receive the Discord bot token: `https://discord.com` or loopback.
 * @param url The URL a request would go to.
 * @returns Whether the token may be sent there.
 */
export function isBotTokenHost(url: URL): boolean {
	if (LOOPBACK_HOSTS.has(url.hostname)) {
		return url.protocol === 'http:' || url.protocol === 'https:';
	}

	return url.protocol === 'https:' && url.host === BOT_TOKEN_HOST;
}

export default {
	DISCORD_EPOCH,
	BOT_TOKEN_HOST,
	getSnowflakeDate,
	isDiscordId,
	getAvatarUrl,
	getDefaultAvatarUrl,
	isBotTokenHost,
};
